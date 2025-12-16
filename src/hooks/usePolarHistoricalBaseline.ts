import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/src/services/firebase';

export type BaselineRange = '7d' | '30d';

export type PolarBaseline = {
  range: BaselineRange;
  daysWithAnyData: number;
  avgExerciseHr: number | null;
  avgExerciseCalories: number | null;
  avgCardioLoadRatio: number | null;
  bestWorkout: {
    date: string;
    avgHr: number | null;
    calories: number | null;
    cardioLoad: number | null;
  } | null;
};

function safeNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, x) => s + x, 0) / valid.length;
}

// Exercises doc shape: { date, exercises: Array<...> }
// Each exercise often has calories and heart_rate.average.
function summarizeExercisesDay(docData: any): { avgHr: number | null; calories: number | null } {
  const list: any[] = Array.isArray(docData?.exercises) ? docData.exercises : [];
  if (list.length === 0) return { avgHr: null, calories: null };

  const hrs = list.map((ex) => safeNumber(ex?.heart_rate?.average));
  const cal = list
    .map((ex) => safeNumber(ex?.calories))
    .filter((v): v is number => v != null)
    .reduce((s, x) => s + x, 0);
  const calValue = Number.isFinite(cal) && cal > 0 ? cal : null;

  return { avgHr: avg(hrs), calories: calValue };
}

function summarizeCardioLoadDay(docData: any): { ratio: number | null } {
  // scripts insert cardioLoad as { data: cardio[0], syncedAt }
  const ratio = safeNumber(docData?.data?.cardio_load_ratio);
  return { ratio };
}

type CacheEntry = {
  fetchedAtMs: number;
  value: PolarBaseline;
};

// Shared cache across all hook instances.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBAL_BASELINE_CACHE: Record<string, CacheEntry> = ((globalThis as any).__QUESTFIT_BASELINE_CACHE__ ??=
  {});

const CACHE_TTL_MS = 5 * 60 * 1000;

export function usePolarHistoricalBaseline(userId: string | null | undefined, range: BaselineRange) {
  const [baseline, setBaseline] = useState<PolarBaseline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cacheRef = useRef<Record<string, CacheEntry>>(GLOBAL_BASELINE_CACHE);

  const cacheKey = useMemo(() => {
    const uid = (userId ?? '').trim();
    if (!uid) return null;
    return `${uid}__${range}`;
  }, [userId, range]);

  useEffect(() => {
    let cancelled = false;
    const uid = (userId ?? '').trim();
    if (!uid || !cacheKey) {
      setBaseline(null);
      setLoading(false);
      setError(null);
      return;
    }

    // If we already have a baseline for this key, keep showing it while refreshing
    // (prevents rapid "Loading baseline..." flashes during frequent re-renders).
    const existing = cacheRef.current[cacheKey];
    if (existing) {
      setBaseline(existing.value);
      setError(null);
    }

    const cache = cacheRef.current;
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.fetchedAtMs < CACHE_TTL_MS) {
      setBaseline(cached.value);
      setLoading(false);
      setError(null);
      return;
    }

    const hasBaselineAlready = baseline != null || existing != null;
    setLoading(!hasBaselineAlready);
    setRefreshing(hasBaselineAlready);
    setError(null);

    (async () => {
      try {
        const n = range === '7d' ? 7 : 30;

        const exercisesQ = query(
          collection(db, `users/${uid}/polarData/exercises/all`),
          orderBy('date', 'desc'),
          limit(n)
        );
        const cardioQ = query(
          collection(db, `users/${uid}/polarData/cardioLoad/all`),
          orderBy('date', 'desc'),
          limit(n)
        );

        const [exSnap, cardioSnap] = await Promise.all([getDocs(exercisesQ), getDocs(cardioQ)]);

        const exDays = exSnap.docs.map((d) => ({ date: d.id, data: d.data() }));
        const cardioDays = cardioSnap.docs.map((d) => ({ date: d.id, data: d.data() }));
        const cardioByDate = new Map(cardioDays.map((d) => [d.date, d.data] as const));

        const dailySummaries = exDays.map((d) => {
          const ex = summarizeExercisesDay(d.data);
          const cardio = summarizeCardioLoadDay(cardioByDate.get(d.date));
          return {
            date: d.date,
            avgHr: ex.avgHr,
            calories: ex.calories,
            cardioLoad: cardio.ratio,
          };
        });

        const daysWithAnyData = dailySummaries.filter(
          (d) => d.avgHr != null || d.calories != null || d.cardioLoad != null
        ).length;

        const avgExerciseHr = avg(dailySummaries.map((d) => d.avgHr));
        const avgExerciseCalories = avg(dailySummaries.map((d) => d.calories));
        const avgCardioLoadRatio = avg(dailySummaries.map((d) => d.cardioLoad));

        // Best workout: rank by calories first, then cardio load, then avg HR.
        const best = dailySummaries
          .slice()
          .sort((a, b) => {
            const aC = a.calories ?? -1;
            const bC = b.calories ?? -1;
            if (bC !== aC) return bC - aC;
            const aL = a.cardioLoad ?? -1;
            const bL = b.cardioLoad ?? -1;
            if (bL !== aL) return bL - aL;
            const aH = a.avgHr ?? -1;
            const bH = b.avgHr ?? -1;
            return bH - aH;
          })[0];

        const value: PolarBaseline = {
          range,
          daysWithAnyData,
          avgExerciseHr: avgExerciseHr != null ? Math.round(avgExerciseHr) : null,
          avgExerciseCalories: avgExerciseCalories != null ? Math.round(avgExerciseCalories) : null,
          avgCardioLoadRatio: avgCardioLoadRatio != null ? Math.round(avgCardioLoadRatio * 1000) / 1000 : null,
          bestWorkout: best
            ? {
                date: best.date,
                avgHr: best.avgHr != null ? Math.round(best.avgHr) : null,
                calories: best.calories != null ? Math.round(best.calories) : null,
                cardioLoad: best.cardioLoad != null ? Math.round(best.cardioLoad * 1000) / 1000 : null,
              }
            : null,
        };

        if (cancelled) return;
        cacheRef.current[cacheKey] = { fetchedAtMs: Date.now(), value };
        setBaseline(value);
      } catch (e: any) {
        if (cancelled) return;
        setBaseline(null);
        setError(e?.message ? String(e.message) : 'Failed to load baseline');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, range, userId]);

  return { baseline, loading, refreshing, error };
}
