import { WorkoutData, Creature, WorkoutSession } from '../types/polar';
import { WorkoutProcessor } from '../utils/workoutProcessor';
import creatureService from '../services/creatureService';
import gameService from '../services/gameService';
import { doc, updateDoc, increment, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface WorkoutCompletionResult {
  success: boolean;
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  unlockedCreatures: Creature[];
  newLevel?: number;
  workoutSession: WorkoutSession;
}

interface LiveWorkoutMetrics {
  duration: number; // in seconds
  averageHeartRate: number;
  maxHeartRate: number;
  minHeartRate: number;
  caloriesBurned: number;
  currentZone: number;
}

class WorkoutCompletionService {
  /**
   * Complete a workout from Polar API data and award XP/creatures
   */
  async completeWorkout(
    userId: string,
    workoutData: WorkoutData
  ): Promise<WorkoutCompletionResult> {
    try {
      // 1. Calculate base XP from workout
      const baseXP = WorkoutProcessor.calculateExperience(workoutData);
      
      // 2. Get user's current captured creatures (IDs only)
      const profile = await gameService.getUserProfile(userId);
      const capturedIds = profile?.capturedCreatures || [];
      
      // 3. Check for creature unlocks
      const unlockedCreatures = WorkoutProcessor.checkForCreatureUnlocks(
        workoutData,
        capturedIds
      );
      
      // 4. Calculate bonus XP from creatures
      let bonusXP = 0;
      for (const creature of unlockedCreatures) {
        bonusXP += creatureService.getExperienceReward(creature.id);
      }
      
      const totalXP = baseXP + bonusXP;
      
      // 5. Create workout session record (ensure no undefined values)
      const workoutSession: WorkoutSession = {
        id: workoutData.id || `polar-${Date.now()}`,
        userId: userId,
        polarWorkoutId: workoutData.id || '',
        startTime: new Date(workoutData['start-time']),
        endTime: new Date(new Date(workoutData['start-time']).getTime() + 
          WorkoutProcessor.parseDuration(workoutData.duration) * 60000),
        calories: workoutData.calories || 0,
        distance: workoutData.distance || 0,
        duration: WorkoutProcessor.parseDuration(workoutData.duration) || 0,
        avgHeartRate: workoutData['heart-rate']?.average || 0,
        maxHeartRate: workoutData['heart-rate']?.maximum || 0,
        sport: workoutData.sport || 'UNKNOWN',
        gameRewards: {
          experienceGained: totalXP || 0,
          creaturesFound: unlockedCreatures || [],
          questProgress: []
        }
      };
      
      // 6. save to Firebase
      await this.saveWorkoutToFirebase(userId, workoutSession, unlockedCreatures, totalXP);
      
      // 7. add XP and check for level up
      const newLevel = await gameService.addExperience(userId, totalXP);
      
      return {
        success: true,
        baseXP,
        bonusXP,
        totalXP,
        unlockedCreatures,
        newLevel,
        workoutSession
      };
    } catch (error) {
      console.error('Error completing workout:', error);
      throw error;
    }
  }

  /**
   * Complete a workout from live tracking metrics (local workout)
   */
  async completeLiveWorkout(
    userId: string,
    metrics: LiveWorkoutMetrics,
    sport: string = 'FITNESS'
  ): Promise<WorkoutCompletionResult> {
    try {
      // Convert live metrics to WorkoutData format for processing
      const durationMinutes = Math.floor(metrics.duration / 60);
      
      // 1. Calculate base XP
      const caloriePoints = metrics.caloriesBurned * 0.1;
      const durationPoints = durationMinutes * 0.5;
      const heartRateBonus = metrics.averageHeartRate > 140 ? 10 : 0;
      const baseXP = Math.floor(caloriePoints + durationPoints + heartRateBonus);
      
      // 2. Get user's current captured creatures (IDs only)
      const profile = await gameService.getUserProfile(userId);
      const capturedIds = profile?.capturedCreatures || [];
      
      // 3. Check for creature unlocks
      const unlockedCreatures = creatureService.checkWorkoutForUnlocks(
        {
          calories: metrics.caloriesBurned,
          duration: durationMinutes,
          distance: 0, // Live workouts don't track distance yet
          avgHeartRate: metrics.averageHeartRate,
          sport
        },
        capturedIds
      );
      
      // 4. Calculate bonus XP from creatures
      let bonusXP = 0;
      for (const creature of unlockedCreatures) {
        bonusXP += creatureService.getExperienceReward(creature.id);
      }
      
      const totalXP = baseXP + bonusXP;
      
      // 5. Create workout session record (ensure no undefined values)
      const workoutSession: WorkoutSession = {
        id: `local-${Date.now()}`,
        userId: userId,
        polarWorkoutId: '',
        startTime: new Date(Date.now() - metrics.duration * 1000),
        endTime: new Date(),
        calories: metrics.caloriesBurned || 0,
        distance: 0,
        duration: durationMinutes || 0,
        avgHeartRate: metrics.averageHeartRate || 0,
        maxHeartRate: metrics.maxHeartRate || 0,
        sport: sport || 'FITNESS',
        gameRewards: {
          experienceGained: totalXP || 0,
          creaturesFound: unlockedCreatures || [],
          questProgress: []
        }
      };
      
      // 6. Save to Firebase
      await this.saveWorkoutToFirebase(userId, workoutSession, unlockedCreatures, totalXP);
      
      // 7. Add XP and check for level up
      const newLevel = await gameService.addExperience(userId, totalXP);
      
      return {
        success: true,
        baseXP,
        bonusXP,
        totalXP,
        unlockedCreatures,
        newLevel,
        workoutSession
      };
    } catch (error) {
      console.error('Error completing live workout:', error);
      throw error;
    }
  }

  /**
   * Save workout data to Firebase
   */
  private async saveWorkoutToFirebase(
    userId: string,
    workoutSession: WorkoutSession,
    unlockedCreatures: Creature[],
    totalXP: number
  ): Promise<void> {
    try {
      // 1. Save workout session to workoutSessions collection
      const sessionId = await gameService.saveWorkoutSession(workoutSession);
      
      // 2. Update user document with XP and stats
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        await setDoc(userRef, {
          xp: totalXP,
          level: Math.floor(totalXP / 100) + 1,
          totalWorkouts: 1,
          totalCalories: workoutSession.calories,
          totalDistance: workoutSession.distance,
          totalDuration: workoutSession.duration,
          totalAvgHeartRate: workoutSession.avgHeartRate,
          capturedCreatures: unlockedCreatures.map(c => c.id), // Store only IDs
          achievements: [],
          workoutHistory: [
            {
              sessionId,
              date: workoutSession.endTime,
              xpEarned: totalXP,
              sport: workoutSession.sport,
              calories: workoutSession.calories,
              duration: workoutSession.duration,
              avgHeartRate: workoutSession.avgHeartRate
            }
          ]
        });
      } else {
        // Update existing user document
        const currentData = userDoc.data();
        const currentWorkouts = currentData.totalWorkouts || 0;
        const currentAvgHR = currentData.totalAvgHeartRate || 0;
        
        // Calculate new average heart rate
        const newAvgHR = ((currentAvgHR * currentWorkouts) + workoutSession.avgHeartRate) / (currentWorkouts + 1);
        
        // Calculate new level
        const newTotalXP = (currentData.xp || 0) + totalXP;
        const newLevel = Math.floor(newTotalXP / 100) + 1;
        
        await updateDoc(userRef, {
          xp: increment(totalXP),
          totalWorkouts: increment(1),
          totalCalories: increment(workoutSession.calories),
          totalDistance: increment(workoutSession.distance),
          totalDuration: increment(workoutSession.duration),
          totalAvgHeartRate: newAvgHR,
          workoutHistory: arrayUnion({
            sessionId,
            date: workoutSession.endTime,
            xpEarned: totalXP,
            sport: workoutSession.sport,
            calories: workoutSession.calories,
            duration: workoutSession.duration,
            avgHeartRate: workoutSession.avgHeartRate
          })
        });
        
        // Update level if it increased
        if (newLevel > (currentData.level || 1)) {
          await updateDoc(userRef, { level: newLevel });
        }
      }
      
      // 3. Add captured creatures to user profile
      for (const creature of unlockedCreatures) {
        await gameService.addCapturedCreature(userId, creature);
      }
      
    } catch (error) {
      console.error('Error saving workout to Firebase:', error);
      throw error;
    }
  }

  /**
   * Get workout summary for display
   */
  getWorkoutSummary(result: WorkoutCompletionResult): string {
    const session = result.workoutSession;
    const lines = [
      `🏃 ${session.sport} Workout Complete!`,
      `⏱️ Duration: ${session.duration} minutes`,
      `🔥 Calories: ${session.calories} kcal`,
      `❤️ Avg HR: ${session.avgHeartRate} bpm`,
      ``,
      `⭐ XP Earned:`,
      `  Base XP: ${result.baseXP}`,
    ];
    
    if (result.bonusXP > 0) {
      lines.push(`  Bonus XP: ${result.bonusXP}`);
    }
    
    lines.push(`  Total: ${result.totalXP} XP`);
    
    if (result.unlockedCreatures.length > 0) {
      lines.push(``);
      lines.push(`🎉 Creatures Unlocked: ${result.unlockedCreatures.length}`);
      result.unlockedCreatures.forEach(c => {
        lines.push(`  • ${c.name} (${c.type})`);
      });
    }
    
    if (result.newLevel) {
      lines.push(``);
      lines.push(`🆙 Level Up! Now Level ${result.newLevel}`);
    }
    
    return lines.join('\n');
  }
}

export default new WorkoutCompletionService();
