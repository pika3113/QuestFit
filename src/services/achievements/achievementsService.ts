import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/src/services/firebase';
import type {
  AchievementDefinition,
  AchievementProgress,
  UserAchievementsDoc,
} from '@/src/types/achievements';
import { ACHIEVEMENTS } from '@/src/services/achievements/definitions';

import heartRateTrackingService from '@/src/services/heartRateTrackingService';

type UserProfileLike = {
  xp?: number;
  totalWorkouts?: number;
  totalCalories?: number;
  totalDistance?: number; // km in existing app
  totalDuration?: number; // seconds in existing app
  streakDays?: number;

  // Optional history used for richer achievements
  workoutHistory?: Array<{
    sessionId?: string;
    date?: any;
    sport?: string;
    calories?: number;
    duration?: number;
    avgHeartRate?: number;
  }>;

  // Derived metrics computed during sync
  workoutDaysLast7?: number;
  sleepScoreStreak75?: number;
  maxSingleDistanceKmLast90?: number;
  hrZone45MinutesLast30?: number;
  trainerSessionsLast90?: number;
  sportCounts?: Record<string, number>;
};

function nowIso() {
  return new Date().toISOString();
}

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateStringsBack(endInclusive: Date, days: number): string[] {
  const end = new Date(endInclusive);
  end.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(formatYmdLocal(addDays(end, -i)));
  }
  return out;
}

function normalizeSport(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s.toUpperCase();
}

function parseIsoDurationToMinutes(value: unknown): number {
  if (typeof value !== 'string') return 0;
  // Handles common ISO8601 durations like PT1H2M3S
  const m = value.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const hours = m[1] ? Number(m[1]) : 0;
  const minutes = m[2] ? Number(m[2]) : 0;
  const seconds = m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return hours * 60 + minutes + Math.floor(seconds / 60);
}

function extractExercisesList(dayDoc: any): any[] {
  if (!dayDoc) return [];
  if (Array.isArray(dayDoc.exercises)) return dayDoc.exercises;
  if (dayDoc.data && Array.isArray(dayDoc.data.exercises)) return dayDoc.data.exercises;
  return [];
}

function isTrainerSport(sport: string): boolean {
  const s = sport.toUpperCase();
  return s.includes('FITNESS') || s.includes('CIRCUIT') || s.includes('STRENGTH') || s.includes('GYM');
}

function getMetricValue(profile: UserProfileLike, def: AchievementDefinition): number {
  switch (def.metric) {
    case 'totalWorkouts':
      return profile.totalWorkouts ?? 0;
    case 'totalCalories':
      return profile.totalCalories ?? 0;
    case 'totalDistanceKm':
      return profile.totalDistance ?? 0;
    case 'totalDurationMinutes':
      return Math.round((profile.totalDuration ?? 0) / 60);
    case 'xp':
      return profile.xp ?? 0;
    case 'streakDays':
      return profile.streakDays ?? 0;
    case 'workoutDaysLast7':
      return profile.workoutDaysLast7 ?? 0;
    case 'sleepScoreStreak75':
      return profile.sleepScoreStreak75 ?? 0;
    case 'maxSingleDistanceKmLast90':
      return profile.maxSingleDistanceKmLast90 ?? 0;
    case 'hrZone45MinutesLast30':
      return profile.hrZone45MinutesLast30 ?? 0;
    case 'trainerSessionsLast90':
      return profile.trainerSessionsLast90 ?? 0;
    case 'sportCount': {
      const sportKey = normalizeSport(def.meta?.sport) ?? '';
      if (!sportKey) return 0;
      return profile.sportCounts?.[sportKey] ?? 0;
    }
    default:
      return 0;
  }
}

async function computeDerivedMetrics(userId: string, profile: UserProfileLike): Promise<Pick<
  UserProfileLike,
  | 'workoutDaysLast7'
  | 'sleepScoreStreak75'
  | 'maxSingleDistanceKmLast90'
  | 'hrZone45MinutesLast30'
  | 'trainerSessionsLast90'
  | 'sportCounts'
>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last7 = dateStringsBack(today, 7);
  const last30 = dateStringsBack(today, 30);

  const exercisesStart = formatYmdLocal(addDays(today, -89));
  const exercisesEnd = formatYmdLocal(today);

  // 1) Exercises (last 90 days)
  const exercisesRef = collection(db, `users/${userId}/polarData/exercises/all`);
  const exercisesQuery = query(
    exercisesRef,
    where(documentId(), '>=', exercisesStart),
    where(documentId(), '<=', exercisesEnd)
  );
  const exercisesSnap = await getDocs(exercisesQuery);

  const exercisesByDate = new Map<string, any>();
  const sportCounts: Record<string, number> = {};
  let trainerSessionsLast90 = 0;
  let maxSingleDistanceKmLast90 = 0;
  let hrZone45MinutesLast30 = 0;
  let sawHrZonesInExercises = false;

  exercisesSnap.forEach((d) => exercisesByDate.set(d.id, d.data()));

  for (const [date, dayDoc] of exercisesByDate.entries()) {
    const list = extractExercisesList(dayDoc);
    for (const ex of list) {
      const sport = normalizeSport(ex?.sport);
      if (sport) {
        sportCounts[sport] = (sportCounts[sport] ?? 0) + 1;
        if (isTrainerSport(sport)) trainerSessionsLast90 += 1;
      }

      const distanceMeters = typeof ex?.distance === 'number' ? ex.distance : 0;
      if (distanceMeters > 0) {
        maxSingleDistanceKmLast90 = Math.max(maxSingleDistanceKmLast90, distanceMeters / 1000);
      }

      // HR zones (if available on exercise payload)
      const zones = Array.isArray(ex?.heart_rate_zones)
        ? ex.heart_rate_zones
        : Array.isArray(ex?.['heart-rate-zones'])
          ? ex['heart-rate-zones']
          : null;
      if (zones) {
        sawHrZonesInExercises = true;
        zones.forEach((z: any) => {
          const idx = typeof z?.index === 'number' ? z.index : typeof z?.zone === 'number' ? z.zone : null;
          const inZone = z?.['in-zone'] ?? z?.in_zone ?? z?.inZone;
          if (idx === 4 || idx === 5) {
            hrZone45MinutesLast30 += parseIsoDurationToMinutes(inZone);
          }
        });
      }
    }
  }

  // Include workoutHistory sports as a fallback signal (especially for legacy/live sessions)
  if (Array.isArray(profile.workoutHistory)) {
    for (const item of profile.workoutHistory) {
      const sport = normalizeSport(item?.sport);
      if (!sport) continue;
      sportCounts[sport] = (sportCounts[sport] ?? 0) + 1;
      if (isTrainerSport(sport)) trainerSessionsLast90 += 1;
    }
  }

  // 2) Weekly consistency: days with at least 1 exercise in last 7 days
  const workoutDaysLast7 = last7.reduce((sum, ds) => {
    const dayDoc = exercisesByDate.get(ds);
    if (!dayDoc) return sum;
    const list = extractExercisesList(dayDoc);
    const count = typeof dayDoc?.count === 'number' ? dayDoc.count : list.length;
    return sum + (count > 0 ? 1 : 0);
  }, 0);

  // 3) Sleep score streak (>= 75) ending today (check last 30 days)
  const sleepStart = formatYmdLocal(addDays(today, -29));
  const sleepEnd = formatYmdLocal(today);
  const sleepRef = collection(db, `users/${userId}/polarData/sleep/all`);
  const sleepQuery = query(
    sleepRef,
    where(documentId(), '>=', sleepStart),
    where(documentId(), '<=', sleepEnd)
  );
  const sleepSnap = await getDocs(sleepQuery);
  const sleepScoreByDate = new Map<string, number>();
  sleepSnap.forEach((d) => {
    const score = d.data()?.sleep_score;
    if (typeof score === 'number') sleepScoreByDate.set(d.id, score);
  });

  let sleepScoreStreak75 = 0;
  for (let i = last30.length - 1; i >= 0; i--) {
    const ds = last30[i];
    const score = sleepScoreByDate.get(ds);
    if (typeof score !== 'number' || score < 75) break;
    sleepScoreStreak75 += 1;
  }

  // 4) HR zone fallback: use recorded HR points as minute-ish samples
  // Only if we didn't see HR zones embedded on exercises.
  if (!sawHrZonesInExercises) {
    try {
      const startDate = addDays(today, -29);
      const distribution = await heartRateTrackingService.getHeartRateZoneDistribution(userId, startDate, today);
      const z4 = distribution?.[4] ?? 0;
      const z5 = distribution?.[5] ?? 0;
      const inferredMinutes = (typeof z4 === 'number' ? z4 : 0) + (typeof z5 === 'number' ? z5 : 0);
      hrZone45MinutesLast30 = Math.max(hrZone45MinutesLast30, inferredMinutes);
    } catch {
      // Ignore HR fallback errors; keep progress at 0.
    }
  }

  return {
    workoutDaysLast7,
    sleepScoreStreak75,
    maxSingleDistanceKmLast90: Math.round(maxSingleDistanceKmLast90 * 100) / 100,
    hrZone45MinutesLast30,
    trainerSessionsLast90,
    sportCounts,
  };
}

export async function getUserAchievements(userId: string): Promise<UserAchievementsDoc | null> {
  const ref = doc(db, `users/${userId}/meta/achievements`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserAchievementsDoc;
}

export function computeAchievementsProgress(
  profile: UserProfileLike,
  existing?: UserAchievementsDoc | null
): { definitions: AchievementDefinition[]; progress: Record<string, AchievementProgress> } {
  const progress: Record<string, AchievementProgress> = { ...(existing?.achievements ?? {}) };

  for (const def of ACHIEVEMENTS) {
    const currentValue = getMetricValue(profile, def);
    const prev = progress[def.id];

    const alreadyUnlocked = prev?.unlocked === true;
    const shouldUnlock = currentValue >= def.threshold;

    const unlockedAt = alreadyUnlocked
      ? prev?.unlockedAt
      : shouldUnlock
        ? nowIso()
        : undefined;

    const next: AchievementProgress = {
      achievementId: def.id,
      progress: Math.min(currentValue, def.threshold),
      unlocked: alreadyUnlocked || shouldUnlock,
      ...(unlockedAt ? { unlockedAt } : {}),
    };

    progress[def.id] = next;
  }

  return { definitions: ACHIEVEMENTS, progress };
}

export async function syncUserAchievements(params: {
  userId: string;
  profile: UserProfileLike;
}): Promise<UserAchievementsDoc> {
  const { userId, profile } = params;
  const existing = await getUserAchievements(userId);

  // Compute richer metrics from recent Firestore data (best-effort; fail closed to zeros)
  let derived: Partial<UserProfileLike> = {};
  try {
    derived = await computeDerivedMetrics(userId, profile);
  } catch {
    derived = {};
  }

  const computed = computeAchievementsProgress({ ...profile, ...derived }, existing);

  const docData: UserAchievementsDoc = {
    userId,
    updatedAt: nowIso(),
    achievements: computed.progress,
  };

  // Avoid excessive writes: only write when achievements actually change.
  // (updatedAt is always new, so compare without it.)
  const existingStr = JSON.stringify(existing?.achievements ?? {});
  const computedStr = JSON.stringify(docData.achievements);
  if (existing && existingStr === computedStr) {
    return { ...existing, updatedAt: existing.updatedAt };
  }

  const ref = doc(db, `users/${userId}/meta/achievements`);
  await setDoc(ref, docData, { merge: true });

  return docData;
}
