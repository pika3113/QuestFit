export type AchievementCategory =
  | 'workout'
  | 'consistency'
  | 'sleep'
  | 'steps'
  | 'rewards'
  | 'heart'
  | 'variety';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: string; // Ionicons name
  color: string;
  points: number;

  // Optional metadata used by some metrics (e.g. per-sport achievements)
  meta?: {
    sport?: string;
  };

  // How to evaluate progress.
  // Some metrics are derived from recent Firestore polarData during sync.
  metric:
    | 'totalWorkouts'
    | 'totalCalories'
    | 'totalDistanceKm'
    | 'totalDurationMinutes'
    | 'xp'
    | 'streakDays'
    | 'workoutDaysLast7'
    | 'sleepScoreStreak75'
    | 'maxSingleDistanceKmLast90'
    | 'hrZone45MinutesLast30'
    | 'trainerSessionsLast90'
    | 'sportCount';

  threshold: number;
}

export interface AchievementProgress {
  achievementId: string;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UserAchievementsDoc {
  userId: string;
  updatedAt: string;
  achievements: Record<string, AchievementProgress>;
}
