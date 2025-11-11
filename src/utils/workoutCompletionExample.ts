// Example implementation for integrating creature unlocks in your workout flow

import { useAuth } from '@/src/hooks/useAuth';
import { useCreatureUnlock } from '@/src/hooks/useCreatureUnlock';
import { CreatureUnlockModal } from '@/components/game/CreatureUnlockModal';
import { WorkoutData } from '@/src/types/polar';
import gameService from '@/src/services/gameService';
import creatureService from '@/src/services/creatureService';

/**
 * Example: Add this to your workout completion logic
 * 
 * This shows how to check for creature unlocks after a workout is completed
 */

export const handleWorkoutComplete = async (
  workoutData: WorkoutData,
  userId: string
) => {
  try {
    // 1. Save the workout session
    const sessionId = await gameService.saveWorkoutSession({
      id: '',
      userId: userId,
      polarWorkoutId: workoutData.id,
      startTime: new Date(workoutData['start-time']),
      endTime: new Date(),
      calories: workoutData.calories,
      distance: workoutData.distance,
      duration: parseDuration(workoutData.duration),
      avgHeartRate: workoutData['heart-rate'].average,
      maxHeartRate: workoutData['heart-rate'].maximum,
      sport: workoutData.sport,
      gameRewards: {
        experienceGained: 0,
        creaturesFound: [],
        questProgress: []
      }
    });

    // 2. Calculate and award base XP
    const baseXP = calculateWorkoutXP(workoutData);
    await gameService.addExperience(userId, baseXP);

    // 3. Check for creature unlocks using the hook
    // This will automatically:
    // - Check which creatures are unlocked
    // - Add them to user profile
    // - Award bonus XP for each creature
    const { checkWorkoutForUnlocks } = useCreatureUnlock(userId);
    const unlockedCreatures = await checkWorkoutForUnlocks(workoutData);

    // 4. Show celebration modal if creatures were unlocked
    if (unlockedCreatures.length > 0) {
      return {
        success: true,
        unlockedCreatures,
        totalXP: baseXP + unlockedCreatures.reduce((sum, c) => 
          sum + creatureService.getExperienceReward(c.id), 0
        )
      };
    }

    return {
      success: true,
      unlockedCreatures: [],
      totalXP: baseXP
    };

  } catch (error) {
    console.error('Error completing workout:', error);
    throw error;
  }
};

// Helper functions
function parseDuration(isoDuration: string): number {
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return 0;
  
  const hours = parseInt(matches[1] || '0');
  const minutes = parseInt(matches[2] || '0');
  const seconds = parseInt(matches[3] || '0');
  
  return hours * 60 + minutes + Math.floor(seconds / 60);
}

function calculateWorkoutXP(workout: WorkoutData): number {
  const caloriePoints = workout.calories * 0.1;
  const distancePoints = (workout.distance / 1000) * 5;
  const durationMinutes = parseDuration(workout.duration);
  const durationPoints = durationMinutes * 0.5;
  const heartRateBonus = workout['heart-rate'].average > 140 ? 10 : 0;
  
  return Math.floor(caloriePoints + distancePoints + durationPoints + heartRateBonus);
}
