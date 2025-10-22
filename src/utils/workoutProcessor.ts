import { WorkoutData, Creature } from '../types/polar';

export class WorkoutProcessor {
  static calculateExperience(workout: WorkoutData): number {
    // Base experience calculation
    const caloriePoints = workout.calories * 0.1;
    const distancePoints = (workout.distance / 1000) * 5; // 5 points per km
    const durationPoints = parseInt(workout.duration.split(':')[1]) * 0.5; // 0.5 points per minute
    const heartRateBonus = workout['heart-rate'].average > 140 ? 10 : 0;
    
    return Math.floor(caloriePoints + distancePoints + durationPoints + heartRateBonus);
  }

  static findAvailableCreatures(workout: WorkoutData, allCreatures: Creature[]): Creature[] {
    return allCreatures.filter(creature => {
      const req = creature.requiredWorkout;
      
      // Check all requirements
      if (req.minCalories && workout.calories < req.minCalories) return false;
      if (req.minDistance && workout.distance < req.minDistance) return false;
      if (req.minHeartRate && workout['heart-rate'].average < req.minHeartRate) return false;
      if (req.sport && workout.sport !== req.sport) return false;
      
      // Check duration (convert workout duration from "PT1H30M" format to minutes)
      if (req.minDuration) {
        const duration = this.parseDuration(workout.duration);
        if (duration < req.minDuration) return false;
      }
      
      return true;
    });
  }

  static parseDuration(isoDuration: string): number {
    // Parse ISO 8601 duration format (PT1H30M) to minutes
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
    
    // Simple categorization based on intensity
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
