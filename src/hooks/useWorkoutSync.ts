import { useState, useCallback } from 'react';
import { WorkoutData, Creature, WorkoutSession } from '../types/polar';
import polarApi from '../services/polarApi';
import gameService from '../services/gameService';
import { WorkoutProcessor } from '../utils/workoutProcessor';

export const useWorkoutSync = (userId: string | null) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncWorkouts = useCallback(async () => {
    if (!userId) return;

    try {
      setSyncing(true);
      setError(null);

      // Fetch workouts from Polar API
      const workouts = await polarApi.getWorkouts();
      
      // Get available creatures for matching
      const availableCreatures = await gameService.getAvailableCreatures();
      
      // Process each workout
      for (const workout of workouts) {
        // Check if we already processed this workout
        const existingSessions = await gameService.getUserWorkouts(userId, 100);
        const alreadyProcessed = existingSessions.some(session => 
          session.polarWorkoutId === workout.id
        );
        
        if (alreadyProcessed) continue;

        // Calculate game rewards
        const experience = WorkoutProcessor.calculateExperience(workout);
        const foundCreatures = WorkoutProcessor.findAvailableCreatures(workout, availableCreatures);
        
        // Create workout session record
        const session: WorkoutSession = {
          id: '', // Will be set by Firestore
          userId,
          polarWorkoutId: workout.id,
          startTime: new Date(workout['start-time']),
          endTime: new Date(new Date(workout['start-time']).getTime() + WorkoutProcessor.parseDuration(workout.duration) * 60000),
          calories: workout.calories,
          distance: workout.distance,
          duration: WorkoutProcessor.parseDuration(workout.duration),
          avgHeartRate: workout['heart-rate'].average,
          maxHeartRate: workout['heart-rate'].maximum,
          sport: workout.sport,
          gameRewards: {
            experienceGained: experience,
            creaturesFound: foundCreatures,
            questProgress: [] // TODO: Implement quest progress
          }
        };

        // Save session
        await gameService.saveWorkoutSession(session);
        
        // Add experience to user
        await gameService.addExperience(userId, experience);
        
        // Add captured creatures
        for (const creature of foundCreatures) {
          await gameService.addCapturedCreature(userId, creature);
        }
        
        // Update user stats
        const currentProfile = await gameService.getUserProfile(userId);
        if (currentProfile) {
          await gameService.updateUserProfile(userId, {
            totalWorkouts: currentProfile.totalWorkouts + 1,
            totalCalories: currentProfile.totalCalories + workout.calories,
            totalDistance: currentProfile.totalDistance + workout.distance
          });
        }
      }

      setLastSync(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync workouts');
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  const processWorkout = useCallback(async (workout: WorkoutData): Promise<{
    experience: number;
    creatures: Creature[];
    levelUp: boolean;
  }> => {
    if (!userId) throw new Error('User not authenticated');

    const availableCreatures = await gameService.getAvailableCreatures();
    const experience = WorkoutProcessor.calculateExperience(workout);
    const foundCreatures = WorkoutProcessor.findAvailableCreatures(workout, availableCreatures);
    
    const currentProfile = await gameService.getUserProfile(userId);
    const currentLevel = currentProfile?.level || 1;
    
    // Add experience and check for level up
    const newLevel = await gameService.addExperience(userId, experience);
    const levelUp = newLevel > currentLevel;

    return {
      experience,
      creatures: foundCreatures,
      levelUp
    };
  }, [userId]);

  return {
    syncing,
    lastSync,
    error,
    syncWorkouts,
    processWorkout
  };
};
