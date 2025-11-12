import { WorkoutData, Creature, WorkoutSession } from '../types/polar';
import { WorkoutProcessor } from '../utils/workoutProcessor';
import creatureService from '../services/creatureService';
import gameService from '../services/gameService';
import { doc, updateDoc, increment, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { calculateLevel } from '../utils/levelSystem';

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
  // Handles completing a workout that came from the Polar API and awards XP/creatures
  async completeWorkout(
    userId: string,
    workoutData: WorkoutData
  ): Promise<WorkoutCompletionResult> {
    try {
      // first calculate how much base XP they earned from the workout itself
      const baseXP = WorkoutProcessor.calculateExperience(workoutData);
      
      // grab their profile to see what creatures they already have
      const profile = await gameService.getUserProfile(userId);
      const capturedIds = profile?.capturedCreatures || [];
      
      // check if they unlocked any new creatures from this workout
      const unlockedCreatures = WorkoutProcessor.checkForCreatureUnlocks(
        workoutData,
        capturedIds
      );
      
      // add up bonus XP from any creatures they just caught
      let bonusXP = 0;
      for (const creature of unlockedCreatures) {
        bonusXP += creatureService.getExperienceReward(creature.id);
      }
      
      const totalXP = baseXP + bonusXP;
      
      // build the workout session object (making sure no undefined values sneak in)
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
      
      // save everything to firebase
      await this.saveWorkoutToFirebase(userId, workoutSession, unlockedCreatures, totalXP);
      
      // give them the XP and see if they leveled up
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

  // This one handles workouts tracked locally on the device (not from Polar)
  async completeLiveWorkout(
    userId: string,
    metrics: LiveWorkoutMetrics,
    sport: string = 'FITNESS'
  ): Promise<WorkoutCompletionResult> {
    try {
      // convert seconds to minutes for the calculations
      const durationMinutes = Math.floor(metrics.duration / 60);
      
      // 1. Calculate base XP
      const caloriePoints = metrics.caloriesBurned * 0.1;
      const durationPoints = durationMinutes * 0.5;
      const heartRateBonus = metrics.averageHeartRate > 140 ? 10 : 0;
      const baseXP = Math.floor(caloriePoints + durationPoints + heartRateBonus);
      
      // load up their profile to see which creatures they have already
      const profile = await gameService.getUserProfile(userId);
      const capturedIds = profile?.capturedCreatures || [];
      
      // see if this workout unlocked any creatures
      const unlockedCreatures = creatureService.checkWorkoutForUnlocks(
        {
          calories: metrics.caloriesBurned,
          duration: durationMinutes,
          distance: 0, // local workouts dont track distance yet unfortunately
          avgHeartRate: metrics.averageHeartRate,
          sport
        },
        capturedIds
      );
      
      // calculate the bonus XP from creatures they just unlocked
      let bonusXP = 0;
      for (const creature of unlockedCreatures) {
        bonusXP += creatureService.getExperienceReward(creature.id);
      }
      
      const totalXP = baseXP + bonusXP;
      
      // put together the workout session object (no undefined vals allowed)
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
      
      // save it all to firebase
      await this.saveWorkoutToFirebase(userId, workoutSession, unlockedCreatures, totalXP);
      
      // award the XP and check if they leveled
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

  // Saves all the workout data and updates user stats in Firebase
  private async saveWorkoutToFirebase(
    userId: string,
    workoutSession: WorkoutSession,
    unlockedCreatures: Creature[],
    totalXP: number
  ): Promise<void> {
    try {
      // first save the actual workout session
      const sessionId = await gameService.saveWorkoutSession(workoutSession);
      
      // now update the user's profile with the new stats
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // if this is somehow their first workout we need to create the user doc
        await setDoc(userRef, {
          xp: totalXP,
          level: calculateLevel(totalXP),
          totalWorkouts: 1,
          totalCalories: workoutSession.calories,
          totalDistance: workoutSession.distance,
          totalDuration: workoutSession.duration,
          totalAvgHeartRate: workoutSession.avgHeartRate,
          capturedCreatures: unlockedCreatures.map(c => c.id), // just save IDs not whole objects
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
        // they exist already so just update their stats
        const currentData = userDoc.data();
        const currentWorkouts = currentData.totalWorkouts || 0;
        const currentAvgHR = currentData.totalAvgHeartRate || 0;
        
        // recalculate average heart rate
        const newAvgHR = ((currentAvgHR * currentWorkouts) + workoutSession.avgHeartRate) / (currentWorkouts + 1);
        
        // figure out their new level
        const newTotalXP = (currentData.xp || 0) + totalXP;
        const newLevel = calculateLevel(newTotalXP);
        
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
        
        // update the level if they leveled up
        if (newLevel > (currentData.level || 1)) {
          await updateDoc(userRef, { level: newLevel });
        }
      }
      
      // add any newly captured creatures to their profile
      for (const creature of unlockedCreatures) {
        await gameService.addCapturedCreature(userId, creature);
      }
      
    } catch (error) {
      console.error('Error saving workout to Firebase:', error);
      throw error;
    }
  }

  // creates a nice summary text for showing to the user after their workout
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
