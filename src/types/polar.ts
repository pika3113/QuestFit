// Polar API Types
export interface UserProfile {
  'polar-user-id': number;
  'member-id': string;
  'registration-date': string;
  'first-name': string;
  'last-name': string;
  birthdate: string;
  gender: 'MALE' | 'FEMALE';
  weight: number;
  height: number;
}

export interface WorkoutData {
  id: string;
  'upload-time': string;
  'polar-user': string;
  device: string;
  'device-id': string;
  'start-time': string;
  'start-time-utc-offset': number;
  duration: string;
  calories: number;
  distance: number;
  'heart-rate': {
    average: number;
    maximum: number;
  };
  'training-load': number;
  sport: string;
  'has-route': boolean;
  'club-id': number;
  'club-name': string;
  detailed_sport_info: string;
  fat_percentage: number;
  carbohydrate_percentage: number;
  protein_percentage: number;
  'running-index': number;
  'training-load-pro': {
    carbohydrate_consumption: number;
    fat_consumption: number;
    protein_consumption: number;
    muscle_load: number;
    perceived_load: number;
    cardio_load: number;
  };
}

export interface HeartRateData {
  'polar-user': string;
  'exercise-id': string;
  'heart-rate-zones': Array<{
    index: number;
    'lower-limit': number;
    'upper-limit': number;
    'in-zone': string;
  }>;
  samples: Array<{
    'recording-rate': number;
    'sample-type': string;
    data: string;
  }>;
}

// Game Types
export interface Creature {
  id: string;
  name: string;
  type: 'common' | 'rare' | 'epic' | 'legendary';
  image: string;
  animation?: string;
  stats: {
    power: number;
    speed: number;
    endurance: number;
  };
  requiredWorkout: {
    minCalories?: number;
    minDuration?: number; // in minutes
    minDistance?: number; // in meters
    minHeartRate?: number;
    sport?: string;
  };
}

export interface UserGameProfile {
  userId: string;
  level: number;
  xp: number;
  totalWorkouts: number;
  totalCalories: number;
  totalDistance: number;
  totalDuration: number; // in minutes
  totalAvgHeartRate: number; // average of all workouts
  capturedCreatures: string[]; // Just store creature IDs
  achievements: Achievement[];
  currentQuest?: Quest;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  category: 'distance' | 'calories' | 'workouts' | 'creatures' | 'special';
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  target: {
    type: 'calories' | 'distance' | 'workouts' | 'heart_rate';
    value: number;
  };
  reward: {
    xp: number;
    creature?: Creature;
  };
  progress: number;
  isCompleted: boolean;
  expiresAt?: Date;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  polarWorkoutId: string;
  startTime: Date;
  endTime: Date;
  calories: number;
  distance: number;
  duration: number;
  avgHeartRate: number;
  maxHeartRate: number;
  sport: string;
  gameRewards: {
    experienceGained: number;
    creaturesFound: Creature[];
    questProgress: Quest[];
  };
}
