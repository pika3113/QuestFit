import { WorkoutData, Creature } from '../types/polar';
import creatureService from '../services/creatureService';

export class WorkoutProcessor {
  static calculateExperience(workout: WorkoutData): number {
    // simple XP calculation based on workout metrics
    const caloriePoints = workout.calories * 0.1; // you get 0.1 points per calorie
    const durationPoints = parseInt(workout.duration.split(':')[1]) * 0.5; // and 0.5 points per minute
    const heartRateBonus = workout['heart-rate'].average > 140 ? 10 : 0; // bonus if you really pushed yourself
    
    return Math.floor(caloriePoints + durationPoints + heartRateBonus);
  }

  // checks the workout to see if it unlocked any new creatures
  static checkForCreatureUnlocks(
    workout: WorkoutData, 
    alreadyCapturedIds: string[]
  ): Creature[] {
    const durationMinutes = this.parseDuration(workout.duration);
    
    return creatureService.checkWorkoutForUnlocks(
      {
        calories: workout.calories,
        duration: durationMinutes,
        distance: workout.distance,
        avgHeartRate: workout['heart-rate'].average,
        sport: workout.sport
      },
      alreadyCapturedIds
    );
  }

  static findAvailableCreatures(workout: WorkoutData, allCreatures: Creature[]): Creature[] {
    return allCreatures.filter(creature => {
      const req = creature.requiredWorkout;
      
      // make sure they meet all the requirements
      if (req.minCalories && workout.calories < req.minCalories) return false;
      if (req.minDistance && workout.distance < req.minDistance) return false;
      if (req.minHeartRate && workout['heart-rate'].average < req.minHeartRate) return false;
      if (req.sport && workout.sport !== req.sport) return false;
      
      // check duration (gotta convert from "PT1H30M" format to minutes first)
      if (req.minDuration) {
        const duration = this.parseDuration(workout.duration);
        if (duration < req.minDuration) return false;
      }
      
      return true;
    });
  }

  static parseDuration(isoDuration: string): number {
    // converts iso8601 duration format (like PT1H30M) into total minutes
    const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!matches) return 0;
    
    const hours = parseInt(matches[1] || '0');
    const minutes = parseInt(matches[2] || '0');
    const seconds = parseInt(matches[3] || '0');
    
    return hours * 60 + minutes + Math.floor(seconds / 60);
  }

  static categorizeWorkout(workout: WorkoutData): 'light' | 'moderate' | 'intense' {
    const avgHR = workout['heart-rate'].average;
    const calories = workout.calories;
    const duration = this.parseDuration(workout.duration);
    
    // just a simple way to categorise workout intensity
    if (avgHR > 160 || calories > 500 || duration > 60) {
      return 'intense';
    } else if (avgHR > 120 || calories > 200 || duration > 30) {
      return 'moderate';
    } else {
      return 'light';
    }
  }

  static generateWorkoutSummary(workout: WorkoutData): string {
    const duration = this.parseDuration(workout.duration);
    const intensity = this.categorizeWorkout(workout);
    
    return `${intensity.charAt(0).toUpperCase() + intensity.slice(1)} ${workout.sport.toLowerCase()} session: ${duration} minutes, ${workout.calories} calories, ${(workout.distance / 1000).toFixed(1)}km`;
  }
}
