import { WorkoutData } from '../types/polar';
import workoutCompletionService from '../services/workoutCompletionService';

/**
 * Integration guide for processing Polar API workouts
 * 
 * This file shows how to integrate the workout completion system
 * with the Polar API to automatically award XP and unlock creatures
 * when users sync their Polar workouts.
 */

/**
 * Example: Process a single Polar workout
 */
export async function processPolarWorkout(
  userId: string,
  polarWorkoutData: WorkoutData
) {
  try {
    console.log('Processing Polar workout:', polarWorkoutData.id);
    
    // Complete the workout and award rewards
    const result = await workoutCompletionService.completeWorkout(
      userId,
      polarWorkoutData
    );
    
    console.log('Workout processed successfully!');
    console.log(`Base XP: ${result.baseXP}`);
    console.log(`Bonus XP: ${result.bonusXP}`);
    console.log(`Total XP: ${result.totalXP}`);
    console.log(`Creatures unlocked: ${result.unlockedCreatures.length}`);
    
    if (result.unlockedCreatures.length > 0) {
      console.log('Unlocked creatures:');
      result.unlockedCreatures.forEach(creature => {
        console.log(`  - ${creature.name} (${creature.type})`);
      });
    }
    
    if (result.newLevel) {
      console.log(`🎉 Level up! Now level ${result.newLevel}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error processing Polar workout:', error);
    throw error;
  }
}

/**
 * Example: Fetch and process recent Polar workouts
 */
export async function syncRecentPolarWorkouts(
  userId: string,
  polarAccessToken: string
): Promise<void> {
  try {
    // 1. Fetch recent workouts from Polar API
    const response = await fetch('https://www.polaraccesslink.com/v3/exercises', {
      headers: {
        'Authorization': `Bearer ${polarAccessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Polar workouts');
    }
    
    const data = await response.json();
    const workouts: WorkoutData[] = data.exercises || [];
    
    console.log(`Found ${workouts.length} workouts to process`);
    
    // 2. Process each workout
    const results = [];
    for (const workout of workouts) {
      try {
        const result = await processPolarWorkout(userId, workout);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process workout ${workout.id}:`, error);
        // Continue with next workout even if one fails
      }
    }
    
    console.log(`Successfully processed ${results.length} workouts`);
    
    // 3. Calculate totals
    const totalXP = results.reduce((sum, r) => sum + r.totalXP, 0);
    const totalCreatures = results.reduce((sum, r) => sum + r.unlockedCreatures.length, 0);
    
    console.log(`Total XP earned: ${totalXP}`);
    console.log(`Total creatures unlocked: ${totalCreatures}`);
    
  } catch (error) {
    console.error('Error syncing Polar workouts:', error);
    throw error;
  }
}

/**
 * Example: Process workout when webhook notification is received
 */
export async function handlePolarWebhook(
  userId: string,
  workoutId: string,
  polarAccessToken: string
): Promise<void> {
  try {
    // 1. Fetch workout details from Polar API
    const response = await fetch(
      `https://www.polaraccesslink.com/v3/exercises/${workoutId}`,
      {
        headers: {
          'Authorization': `Bearer ${polarAccessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch workout details');
    }
    
    const workout: WorkoutData = await response.json();
    
    // 2. Process the workout
    await processPolarWorkout(userId, workout);
    
  } catch (error) {
    console.error('Error handling Polar webhook:', error);
    throw error;
  }
}

/**
 * Example: React component usage
 */
export const PolarSyncExample = `
import React, { useState } from 'react';
import { Button, Alert } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { syncRecentPolarWorkouts } from '@/src/utils/polarIntegration';

export function PolarSyncButton() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  
  const handleSync = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }
    
    try {
      setSyncing(true);
      
      // Get Polar access token from your storage/state
      const polarToken = await getPolarAccessToken(user.uid);
      
      if (!polarToken) {
        Alert.alert('Error', 'Please connect your Polar account');
        return;
      }
      
      // Sync workouts
      await syncRecentPolarWorkouts(user.uid, polarToken);
      
      Alert.alert('Success', 'Workouts synced successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync workouts');
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <Button 
      title={syncing ? "Syncing..." : "Sync Polar Workouts"}
      onPress={handleSync}
      disabled={syncing}
    />
  );
}
`;

/**
 * Example: Automatic background sync
 */
export async function setupAutomaticSync(
  userId: string,
  polarAccessToken: string
): Promise<void> {
  // This would typically be set up in a background task or scheduled job
  
  console.log('Setting up automatic Polar sync...');
  
  // Option 1: Periodic sync (e.g., every hour)
  setInterval(async () => {
    try {
      await syncRecentPolarWorkouts(userId, polarAccessToken);
      console.log('Automatic sync completed');
    } catch (error) {
      console.error('Automatic sync failed:', error);
    }
  }, 3600000); // Every hour
  
  // Option 2: Webhook-based sync (recommended)
  // Set up Polar webhook to call handlePolarWebhook when new workouts are available
  // See: https://www.polar.com/accesslink-api/#webhooks
}
