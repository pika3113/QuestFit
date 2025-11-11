import { useState, useCallback } from 'react';
import { Creature, WorkoutData } from '../types/polar';
import { WorkoutProcessor } from '../utils/workoutProcessor';
import creatureService from '../services/creatureService';
import gameService from '../services/gameService';

export const useCreatureUnlock = (userId: string | null) => {
  const [newlyUnlockedCreatures, setNewlyUnlockedCreatures] = useState<Creature[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Check if a completed workout unlocks any new creatures
   */
  const checkWorkoutForUnlocks = useCallback(async (
    workout: WorkoutData
  ): Promise<Creature[]> => {
    if (!userId) return [];

    setIsChecking(true);
    try {
      // Get user's already captured creatures (IDs only)
      const profile = await gameService.getUserProfile(userId);
      const capturedIds = profile?.capturedCreatures || [];

      // Check which creatures this workout unlocks
      const unlockedCreatures = WorkoutProcessor.checkForCreatureUnlocks(
        workout,
        capturedIds
      );

      if (unlockedCreatures.length > 0) {
        // Add creatures to user profile
        for (const creature of unlockedCreatures) {
          await gameService.addCapturedCreature(userId, creature);
          
          // Award XP for capturing the creature
          const xpReward = creatureService.getExperienceReward(creature.id);
          if (xpReward > 0) {
            await gameService.addExperience(userId, xpReward);
          }
        }

        setNewlyUnlockedCreatures(unlockedCreatures);
      }

      return unlockedCreatures;
    } catch (error) {
      console.error('Error checking for creature unlocks:', error);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, [userId]);

  /**
   * Get progress towards unlocking a specific creature
   */
  const getUnlockProgress = useCallback((
    creatureId: string,
    currentWorkout: {
      calories: number;
      duration: number;
      distance?: number;
      avgHeartRate?: number;
      sport?: string;
    }
  ) => {
    return creatureService.getUnlockProgress(creatureId, currentWorkout);
  }, []);

  /**
   * Clear the newly unlocked creatures notification
   */
  const clearUnlockedCreatures = useCallback(() => {
    setNewlyUnlockedCreatures([]);
  }, []);

  /**
   * Get all creatures that can be unlocked with a specific sport
   */
  const getCreaturesForSport = useCallback((sport: string) => {
    return creatureService.getCreaturesBySport(sport);
  }, []);

  return {
    newlyUnlockedCreatures,
    isChecking,
    checkWorkoutForUnlocks,
    getUnlockProgress,
    clearUnlockedCreatures,
    getCreaturesForSport
  };
};
