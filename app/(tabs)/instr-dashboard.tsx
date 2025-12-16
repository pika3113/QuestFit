import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/Themed';
import { SkeletonBlock } from '@/components/Skeleton';
import { useAuth } from '@/src/hooks/useAuth';
import { useInstructor } from '@/src/hooks/useInstructor';
import { useInstructorStudents } from '@/src/hooks/useInstructorStudents';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/src/services/firebase';
import { collection, getDocs, doc, getDoc, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { StudentCard, StudentCardSkeleton, StudentStats, ChartType } from '@/components/instr-dashboard/StudentCard';
import { formatDateDdMm } from '@/src/utils/dateFormat';
import { formatCompactNumber } from '@/src/utils/numberFormat';
import { instructorDashboardScreenStyles as styles, WEB_DATE_INPUT_STYLE } from '@/src/styles/screens/instructorDashboardScreenStyles';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AUTO_FLAG_COOLDOWN_MS = 30 * 60_000;

const MOBILE_CUSTOM_MAX_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type DashboardMode = 'overview' | 'cadets';
type CadetFlag = 'good' | 'bad' | 'none';
type CadetFlagSource = 'manual' | 'ai' | 'none';
type CadetLightDutyMap = Record<string, boolean>;

function formatLocalIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SG_TZ_OFFSET_MINUTES = 8 * 60;

function formatIsoDateWithOffsetMinutes(d: Date, offsetMinutes: number) {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Trend = 'up' | 'down' | 'stable';

type TrendRegressionResult = {
  trend: Trend;
  slope: number;
};

function computeTrendFromStepsAndCalories(
  stepsHistory: number[],
  caloriesHistory: number[],
  slopeThreshold: number = 0.15
): TrendRegressionResult {
  try {
    const idx: number[] = [];
    for (let i = 0; i < stepsHistory.length; i++) {
      const steps = stepsHistory[i] || 0;
      const calories = caloriesHistory[i] || 0;
      if (steps > 0 || calories > 0) idx.push(i);
    }

    if (idx.length < 2) return { trend: 'stable', slope: 0 };

    const stepsForTrend = idx.map((i) => stepsHistory[i] || 0);
    const calsForTrend = idx.map((i) => caloriesHistory[i] || 0);

    const meanStd = (arr: number[]) => {
      const n = arr.length;
      if (n === 0) return { mean: 0, std: 0 };
      const mean = arr.reduce((a, b) => a + b, 0) / n;
      const variance = arr.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n;
      const std = Math.sqrt(variance);
      return { mean, std };
    };

    const sStats = meanStd(stepsForTrend);
    const cStats = meanStd(calsForTrend);

    const combined = idx.map((_, j) => {
      const zS = sStats.std > 0 ? (stepsForTrend[j] - sStats.mean) / sStats.std : 0;
      const zC = cStats.std > 0 ? (calsForTrend[j] - cStats.mean) / cStats.std : 0;
      return zS + zC;
    });

    const n = combined.length;
    if (n < 2) return { trend: 'stable', slope: 0 };

    // x is 0..n-1
    const meanX = (n - 1) / 2;
    const meanY = combined.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - meanX;
      const dy = combined[i] - meanY;
      num += dx * dy;
      den += dx * dx;
    }
    const slope = den > 0 ? num / den : 0;

    // Slope is in (z-score units) per day.
    if (slope > slopeThreshold) return { trend: 'up', slope };
    if (slope < -slopeThreshold) return { trend: 'down', slope };
    return { trend: 'stable', slope };
  } catch {
    return { trend: 'stable', slope: 0 };
  }
}

export default function InstructorDashboard() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 900;
  const isNarrowScreen = windowWidth <= 420;
  const isCompactRange = Platform.OS !== 'web' || isNarrowScreen;
  const quickRangeDays = isCompactRange ? [3, 7, 10] : [7, 14, 30];

  const isCompactViewport = windowHeight <= 760;

  const { user } = useAuth();
  const { isInstructor, loading: instructorLoading } = useInstructor(user?.uid);
  const { selectedUserIds, toggleUser } = useInstructorStudents(user?.uid);

  const selectedIds = Array.isArray(selectedUserIds) ? selectedUserIds : [];
  
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keep last-seen regression slope per user to avoid log spam.
  const lastTrendRegressionRef = React.useRef<Record<string, { slopeRounded: number; trend: Trend }>>({});

  const normalizedSearchQuery = typeof searchQuery === 'string' ? searchQuery : '';
  
  // Filtering & Selection State
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date; type: '3d' | '7d' | '10d' | '14d' | '30d' | 'custom' }>({
    start: new Date(new Date().setDate(new Date().getDate() - 6)), // 7 days including today
    end: new Date(),
    type: '7d'
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('overview');

  const [cadetFlags, setCadetFlags] = useState<Record<string, CadetFlag>>({});
  const [cadetFlagSources, setCadetFlagSources] = useState<Record<string, CadetFlagSource>>({});
  const [cadetFlagReasons, setCadetFlagReasons] = useState<Record<string, string>>({});

  const [cadetLightDuty, setCadetLightDuty] = useState<CadetLightDutyMap>({});

  const [autoFlagState, setAutoFlagState] = useState<'idle' | 'loading' | 'success_ai' | 'success_fallback' | 'error'>('idle');
  const [autoFlagTooltipText, setAutoFlagTooltipText] = useState<string | null>(null);
  const [autoFlagNextAllowedAtMs, setAutoFlagNextAllowedAtMs] = useState<number | null>(null);
  const [autoFlagCooldownTick, setAutoFlagCooldownTick] = useState(0);

  const selectedRangeDays = useMemo(() => {
    const start = startOfLocalDay(dateRange.start);
    const end = startOfLocalDay(dateRange.end);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
    return Math.max(1, diffDays + 1);
  }, [dateRange.start, dateRange.end]);

  const formatMobileCompactNumber = useCallback((value: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    if (isCompactRange && Math.abs(value) >= 1000) return formatCompactNumber(value);
    return Math.round(value).toLocaleString();
  }, [isCompactRange]);

  const persistAutoFlagResult = useCallback(
    async (result: 'success_ai' | 'success_fallback' | 'error') => {
      if (!user?.uid) return;
      try {
        await setDoc(
          doc(db, 'instructors', user.uid),
          {
            autoFlagLastResult: result,
            autoFlagLastResultAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed to persist auto-flag result', e);
      }
    },
    [user?.uid]
  );

  const formatCooldown = useCallback((totalSeconds: number) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }, []);

  const TREND_SLOPE_THRESHOLD = 0.15;

  // Activity display toggle (affects the "distance" metric card/chart)
  const [activityMetric, setActivityMetric] = useState<'steps' | 'distance'>('steps');

  // Chart Configuration State
  const [chartConfig, setChartConfig] = useState<Record<'hr' | 'distance' | 'sleep' | 'calories', ChartType>>({
    hr: 'line',
    distance: 'bar',
    sleep: 'line',
    calories: 'area'
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedConfig = await AsyncStorage.getItem('instructor_chart_config');
        if (savedConfig) {
          setChartConfig(JSON.parse(savedConfig));
        }

        const savedActivityMetric = await AsyncStorage.getItem('instructor_activity_metric');
        if (savedActivityMetric === 'steps' || savedActivityMetric === 'distance') {
          setActivityMetric(savedActivityMetric);
        }
      } catch (e) {
        console.error('Failed to load data', e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadCadetFlags = async () => {
      if (!user?.uid) return;
      try {
        const instructorDoc = await getDoc(doc(db, 'instructors', user.uid));
        const data = instructorDoc.data();
        const raw = data?.cadetFlags;
        const rawSources = data?.cadetFlagSources;
        const rawReasons = data?.cadetFlagReasons;
        const rawLightDuty = (data as any)?.cadetLightDuty;
        if (raw && typeof raw === 'object') {
          setCadetFlags(raw as Record<string, CadetFlag>);
        } else {
          setCadetFlags({});
        }

        if (rawSources && typeof rawSources === 'object') {
          setCadetFlagSources(rawSources as Record<string, CadetFlagSource>);
        } else {
          setCadetFlagSources({});
        }

        if (rawReasons && typeof rawReasons === 'object') {
          setCadetFlagReasons(rawReasons as Record<string, string>);
        } else {
          setCadetFlagReasons({});
        }

        if (rawLightDuty && typeof rawLightDuty === 'object') {
          setCadetLightDuty(rawLightDuty as CadetLightDutyMap);
        } else {
          setCadetLightDuty({});
        }

        const rawNextAllowed = (data as any)?.autoFlagNextAllowedAtMs;
        if (typeof rawNextAllowed === 'number' && Number.isFinite(rawNextAllowed)) {
          setAutoFlagNextAllowedAtMs(rawNextAllowed);
        } else {
          setAutoFlagNextAllowedAtMs(null);
        }

        const rawLastResult = (data as any)?.autoFlagLastResult;
        const rawLastResultAt = (data as any)?.autoFlagLastResultAt;
        const isValidResult = rawLastResult === 'success_ai' || rawLastResult === 'success_fallback' || rawLastResult === 'error';
        const lastAtDate = typeof rawLastResultAt === 'string' ? new Date(rawLastResultAt) : null;
        const lastAtOk = lastAtDate && !Number.isNaN(lastAtDate.getTime());
        const todayLocal = formatLocalIsoDate(new Date());
        const lastLocal = lastAtOk ? formatLocalIsoDate(lastAtDate as Date) : null;

        if (isValidResult && lastLocal === todayLocal) {
          setAutoFlagState(rawLastResult);
        } else {
          // Reset indicator on a new day (or if invalid/missing)
          setAutoFlagState('idle');
        }
      } catch (e) {
        console.error('Failed to load cadet flags', e);
      }
    };
    loadCadetFlags();
  }, [user?.uid]);

  const getCadetFlag = (cadetId: string): CadetFlag => cadetFlags[cadetId] ?? 'none';
  const getCadetFlagSource = (cadetId: string): CadetFlagSource => cadetFlagSources[cadetId] ?? 'none';
  const getCadetFlagReason = (cadetId: string): string => cadetFlagReasons[cadetId] ?? '';
  const isCadetLightDuty = useCallback((cadetId: string) => cadetLightDuty[cadetId] === true, [cadetLightDuty]);

  const setCadetLightDutyStatus = useCallback(
    async (cadetId: string, isLd: boolean) => {
      if (!user?.uid) return;
      setCadetLightDuty((prev) => ({ ...prev, [cadetId]: isLd }));
      try {
        await setDoc(
          doc(db, 'instructors', user.uid),
          {
            cadetLightDuty: { [cadetId]: isLd },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error('Failed to save cadet light-duty status', e);
      }
    },
    [user?.uid]
  );

  const setCadetFlag = useCallback(
    async (cadetId: string, flag: CadetFlag, source: CadetFlagSource = 'manual', reason?: string) => {
      if (!user?.uid) return;
      const nextSource: CadetFlagSource = flag === 'none' ? 'none' : source;
      setCadetFlags((prev) => ({ ...prev, [cadetId]: flag }));
      setCadetFlagSources((prev) => ({ ...prev, [cadetId]: nextSource }));

      const nextReason = flag === 'none' || nextSource === 'manual'
        ? ''
        : (typeof reason === 'string' ? reason : getCadetFlagReason(cadetId));

      setCadetFlagReasons((prev) => ({ ...prev, [cadetId]: nextReason }));
      try {
        await setDoc(
          doc(db, 'instructors', user.uid),
          {
            cadetFlags: { [cadetId]: flag },
            cadetFlagSources: { [cadetId]: nextSource },
            cadetFlagReasons: { [cadetId]: nextReason },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error('Failed to save cadet flag', e);
      }
    },
    [user?.uid, cadetFlagReasons]
  );

  const autoFlagCooldownRemainingMs = Math.max(0, (autoFlagNextAllowedAtMs ?? 0) - (Date.now() + autoFlagCooldownTick * 0));
  const autoFlagCooldownRemainingSec = Math.ceil(autoFlagCooldownRemainingMs / 1000);
  const isAutoFlagCoolingDown = autoFlagCooldownRemainingMs > 0;

  useEffect(() => {
    if (!isAutoFlagCoolingDown) return;
    const id = setInterval(() => setAutoFlagCooldownTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [isAutoFlagCoolingDown]);

  // Save chart config whenever it changes
  useEffect(() => {
    const saveConfig = async () => {
      try {
        await AsyncStorage.setItem('instructor_chart_config', JSON.stringify(chartConfig));
      } catch (e) {
        console.error('Failed to save chart config', e);
      }
    };
    saveConfig();
  }, [chartConfig]);

  useEffect(() => {
    const saveActivityMetric = async () => {
      try {
        await AsyncStorage.setItem('instructor_activity_metric', activityMetric);
      } catch (e) {
        console.error('Failed to save activity metric', e);
      }
    };
    saveActivityMetric();
  }, [activityMetric]);

  const fetchStudentsData = useCallback(async (range = dateRange) => {
    try {
      // 1. Fetch all users (In a real app, you might filter by class/instructor)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const trendRegressionChanges: Array<{ name: string; slopeRounded: number; trend: Trend }> = [];

      const studentsData = await Promise.all(usersSnapshot.docs.map(async (userDoc: any) => {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // 2. Fetch recent exercises
          const hrHistory: number[] = [];
          const distanceHistory: number[] = [];
          const stepsHistory: number[] = [];
          const caloriesHistory: number[] = [];
          const sleepHistory: number[] = []; // Placeholder for now
          
          let lastSync: string | undefined = userData.lastSync;
          const lastChecked: string | undefined = userData.lastChecked;
          
          const dateKeysToFetch: string[] = [];
          const utcFallbackKeys: string[] = [];
          const displayDates: string[] = [];
          const current = new Date(range.start);
          const end = new Date(range.end);
          
          // Normalize to start of day
          current.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);

          while (current <= end) {
            // Firestore docs are keyed by an ISO date string (historically stored using toISOString()).
            // BUT labels should reflect the user's selected calendar days (local dates).
            const localKey = formatLocalIsoDate(current);
            // If we need a fallback, use a fixed UTC+8 key (Singapore) rather than raw UTC,
            // otherwise we can silently shift the day and show misleading values.
            const utcKey = formatIsoDateWithOffsetMinutes(current, SG_TZ_OFFSET_MINUTES);
            displayDates.push(localKey);
            dateKeysToFetch.push(localKey);
            utcFallbackKeys.push(utcKey);
            current.setDate(current.getDate() + 1);
          }

          const getDocsWithUtcFallback = async (basePath: string) => {
            const localSnaps = await Promise.all(
              dateKeysToFetch.map((date) => getDoc(doc(db, `${basePath}/${date}`)))
            );

            const missingIdx: number[] = [];
            for (let i = 0; i < localSnaps.length; i++) {
              if (!localSnaps[i]?.exists() && utcFallbackKeys[i] && utcFallbackKeys[i] !== dateKeysToFetch[i]) {
                missingIdx.push(i);
              }
            }

            if (missingIdx.length === 0) return localSnaps;

            const fallbackSnaps = await Promise.all(
              missingIdx.map((i) => getDoc(doc(db, `${basePath}/${utcFallbackKeys[i]}`)))
            );

            const fallbackByIndex = new Map<number, any>();
            missingIdx.forEach((idx, j) => fallbackByIndex.set(idx, fallbackSnaps[j]));

            return localSnaps.map((snap, i) => (snap?.exists() ? snap : (fallbackByIndex.get(i) || snap)));
          };

          const [exercisesDocs, sleepDocs, activityDocs] = await Promise.all([
            getDocsWithUtcFallback(`users/${userId}/polarData/exercises/all`),
            getDocsWithUtcFallback(`users/${userId}/polarData/sleep/all`),
            getDocsWithUtcFallback(`users/${userId}/polarData/activities/all`),
          ]);

          dateKeysToFetch.forEach((_, index) => {
            const exercisesSnap = exercisesDocs[index];
            const activitySnap = activityDocs[index];

            // HR comes from exercises (best source)
            let dayHrSum = 0;
            let dayHrCount = 0;

            // Distance/Calories prefer activities (more consistently present), fallback to exercises
            let dayDist = 0;
            let dayCals = 0;
            let daySteps = 0;

            if (activitySnap?.exists()) {
              const a = activitySnap.data();

              const steps =
                typeof a?.steps === 'number'
                  ? a.steps
                  : typeof a?.activity?.steps === 'number'
                    ? a.activity.steps
                    : null;

              if (steps != null) {
                daySteps = Math.round(steps);
              }

              const distMeters =
                typeof a?.distance_from_steps === 'number'
                  ? a.distance_from_steps
                  : typeof a?.activity?.distanceMeters === 'number'
                    ? a.activity.distanceMeters
                    : null;

              if (distMeters != null) {
                // StudentCard labels this as Distance (m)
                dayDist = Math.round(distMeters);
              }

              if (typeof a?.calories === 'number') {
                dayCals = Math.round(a.calories);
              } else if (typeof a?.active_calories === 'number') {
                dayCals = Math.round(a.active_calories);
              }
            }

            if (exercisesSnap?.exists()) {
              const data = exercisesSnap.data();
              if (data.exercises && Array.isArray(data.exercises)) {
                let exDist = 0;
                let exCals = 0;
                data.exercises.forEach((ex: any) => {
                  if (ex.heart_rate?.average) {
                    dayHrSum += ex.heart_rate.average;
                    dayHrCount++;
                  }
                  if (typeof ex.distance === 'number') exDist += ex.distance;
                  if (typeof ex.calories === 'number') exCals += ex.calories;
                });

                // Fallback only if activities didn't provide these
                if (dayDist === 0) dayDist = Math.round(exDist);
                if (dayCals === 0) dayCals = Math.round(exCals);
              }
            }

            hrHistory.push(dayHrCount > 0 ? Math.round(dayHrSum / dayHrCount) : 0);
            distanceHistory.push(dayDist);
            stepsHistory.push(daySteps);
            caloriesHistory.push(dayCals);

            // Sleep score (0 if missing)
            const sleepDoc = sleepDocs[index];
            if (sleepDoc?.exists()) {
              const sleepScore = sleepDoc.data()?.sleep_score;
              sleepHistory.push(typeof sleepScore === 'number' ? sleepScore : 0);
            } else {
              sleepHistory.push(0);
            }
          });

          // Fallback: try to derive lastSync from latest sync summary if user profile doesn't have it
          if (!lastSync) {
            try {
              const summaryQuery = query(
                collection(db, `users/${userId}/polarData/syncSummary/all`),
                orderBy('syncedAt', 'desc'),
                limit(1)
              );
              const summarySnapshot = await getDocs(summaryQuery);
              if (!summarySnapshot.empty) {
                lastSync = summarySnapshot.docs[0].data()?.syncedAt;
              }
            } catch (e) {
              // ignore
            }
          }

          // Data is already chronological (Oldest -> Newest)
          
          // Generate labels (DD/MM)
          const labels = displayDates.map((dateStr) => formatDateDdMm(dateStr) || dateStr);
          
          // Calculate Averages (ignoring 0s for HR, but maybe keeping them for others? 
          // Usually average daily steps/cals includes rest days as 0 or low, but let's exclude 0 for "active" stats if preferred.
          // For now, let's exclude 0s for HR, include 0s for others or exclude? 
          // Let's exclude 0s to show "Active Day Average")
          
          const validHrs = hrHistory.filter(v => v > 0);
          const avgHr = validHrs.length > 0 ? Math.round(validHrs.reduce((a, b) => a + b, 0) / validHrs.length) : 0;

          const validDist = distanceHistory.filter(v => v > 0);
          const avgDistance = validDist.length > 0 ? Math.round(validDist.reduce((a, b) => a + b, 0) / validDist.length) : 0;

          const validSteps = stepsHistory.filter(v => v > 0);
          const avgSteps = validSteps.length > 0 ? Math.round(validSteps.reduce((a, b) => a + b, 0) / validSteps.length) : 0;

          const validCals = caloriesHistory.filter(v => v > 0);
          const avgCalories = validCals.length > 0 ? Math.round(validCals.reduce((a, b) => a + b, 0) / validCals.length) : 0;

          const validSleep = sleepHistory.filter(v => v > 0);
          const avgSleep = validSleep.length > 0 ? Math.round(validSleep.reduce((a, b) => a + b, 0) / validSleep.length) : 0;

          const displayName = userData.displayName || 'Unknown Cadet';

          const trendResult = computeTrendFromStepsAndCalories(
            stepsHistory,
            caloriesHistory,
            TREND_SLOPE_THRESHOLD
          );
          const trend: Trend = trendResult.trend;

          // Track slope changes (rounded) per user, but emit a single aggregated log line per refresh.
          const slopeRounded = Math.round((trendResult.slope || 0) * 1000) / 1000;
          const prev = lastTrendRegressionRef.current[userId];
          if (!prev || prev.slopeRounded !== slopeRounded || prev.trend !== trend) {
            trendRegressionChanges.push({ name: displayName, slopeRounded, trend });
            lastTrendRegressionRef.current[userId] = { slopeRounded, trend };
          }

          return {
            id: userId,
            displayName,
            photoURL: userData.photoURL,
            lastSync,
            lastChecked,
            hrHistory,
            distanceHistory,
            stepsHistory,
            sleepHistory,
            caloriesHistory,
            labels,
            avgHr,
            avgDistance,
            avgSteps,
            avgSleep,
            avgCalories,
            trend
          } as StudentStats;
        } catch (err) {
          console.warn(`Failed to fetch data for user ${userDoc.id}`, err);
          return null;
        }
      }));

      if (trendRegressionChanges.length > 0) {
        const summary = trendRegressionChanges
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => `${c.name}(slope=${c.slopeRounded.toFixed(3)},trend=${c.trend})`)
          .join(' | ');

        console.log(
          `[trend-regression] changed=${trendRegressionChanges.length} threshold=${TREND_SLOPE_THRESHOLD}: ${summary}`
        );
      }

      setStudents(studentsData.filter((s: StudentStats | null): s is StudentStats => s !== null));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (isInstructor) {
      fetchStudentsData(dateRange);
    }
  }, [isInstructor, fetchStudentsData, dateRange]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudentsData(dateRange);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(normalizedSearchQuery.toLowerCase());
    // If in selection mode and we have selections, maybe we want to filter?
    // For now, let's just show all and let the user select.
    // Or if the user wants to "view selected", we can add a toggle for that.
    return matchesSearch;
  });

  // Main view shows ONLY selected students (or all if none selected? No, user wants to choose)
  // If no selection, show empty state prompting to select.
  const displayedStudents = students.filter(s => selectedIds.includes(s.id));

  const cohort = displayedStudents;
  const cohortCount = cohort.length;

  const cohortAverages = React.useMemo(() => {
    if (cohortCount === 0) {
      return {
        avgSteps: 0,
        avgDistance: 0,
        avgHr: 0,
        avgSleep: 0,
        avgCalories: 0,
        recentSyncCount: 0,
      };
    }

    const sum = cohort.reduce(
      (acc, s) => {
        acc.avgSteps += s.avgSteps || 0;
        acc.avgDistance += s.avgDistance || 0;
        acc.avgHr += s.avgHr || 0;
        acc.avgSleep += s.avgSleep || 0;
        acc.avgCalories += s.avgCalories || 0;

        const lastSyncMs = s.lastSync ? new Date(s.lastSync).getTime() : NaN;
        const isRecent = Number.isFinite(lastSyncMs) && Date.now() - lastSyncMs < 24 * 60 * 60 * 1000;
        if (isRecent) acc.recentSyncCount += 1;
        return acc;
      },
      { avgSteps: 0, avgDistance: 0, avgHr: 0, avgSleep: 0, avgCalories: 0, recentSyncCount: 0 }
    );

    return {
      avgSteps: Math.round(sum.avgSteps / cohortCount),
      avgDistance: Math.round(sum.avgDistance / cohortCount),
      avgHr: Math.round(sum.avgHr / cohortCount),
      avgSleep: Math.round(sum.avgSleep / cohortCount),
      avgCalories: Math.round(sum.avgCalories / cohortCount),
      recentSyncCount: sum.recentSyncCount,
    };
  }, [cohortCount, cohort]);

  const overviewRanked = React.useMemo(() => {
    if (cohortCount === 0) return [] as Array<{ s: StudentStats; score: number }>;

    const values = cohort.map((s) => ({
      id: s.id,
      stepsOrDist: activityMetric === 'steps' ? (s.avgSteps || 0) : (s.avgDistance || 0),
      calories: s.avgCalories || 0,
      sleep: s.avgSleep || 0,
    }));

    const minMax = (arr: number[]) => {
      const finite = arr.filter((v) => Number.isFinite(v));
      if (finite.length === 0) return { min: 0, max: 0 };
      return { min: Math.min(...finite), max: Math.max(...finite) };
    };

    const stepsMm = minMax(values.map((v) => v.stepsOrDist));
    const calMm = minMax(values.map((v) => v.calories));
    const sleepMm = minMax(values.map((v) => v.sleep));

    const norm = (x: number, mm: { min: number; max: number }) => {
      if (!Number.isFinite(x)) return 0;
      if (mm.max <= mm.min) return 0;
      return (x - mm.min) / (mm.max - mm.min);
    };

    return cohort
      .map((s) => {
        const stepsOrDist = activityMetric === 'steps' ? (s.avgSteps || 0) : (s.avgDistance || 0);
        const score =
          (norm(stepsOrDist, stepsMm) + norm(s.avgCalories || 0, calMm) + norm(s.avgSleep || 0, sleepMm)) / 3;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [cohort, cohortCount, activityMetric]);

  const formatLastSyncShort = (value: string | undefined) => {
    if (!value) return 'No sync';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No sync';
    const diffMs = Date.now() - date.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 1) return 'Synced <1h';
    if (hours < 24) return `Synced ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Synced ${days}d`;
  };

  const flaggedCounts = React.useMemo(() => {
    const counts = { good: 0, bad: 0, none: 0 };
    cohort.forEach((s) => {
      const f = getCadetFlag(s.id);
      counts[f] += 1;
    });
    return counts;
  }, [cohort, cadetFlags]);

  const isCadetUnflagged = useCallback(
    (cadetId: string) => (cadetFlags[cadetId] ?? 'none') === 'none',
    [cadetFlags]
  );

  const showAutoFlagTooltip = useCallback((text: string) => {
    if (Platform.OS !== 'web') return;
    setAutoFlagTooltipText(text);
  }, []);

  const hideAutoFlagTooltip = useCallback(() => {
    if (Platform.OS !== 'web') return;
    setAutoFlagTooltipText(null);
  }, []);

  const runAutoFlagSimple = useCallback(async () => {
    if (overviewRanked.length === 0) return;
    const unflaggedRanked = overviewRanked.filter((r) => isCadetUnflagged(r.s.id));
    if (unflaggedRanked.length === 0) return;

    const topN = Math.max(1, Math.round(unflaggedRanked.length * 0.2));
    const bottomN = Math.max(1, Math.round(unflaggedRanked.length * 0.2));

    const top = unflaggedRanked.slice(0, topN).map((r) => r.s.id);
    // Be more lenient for Light-Duty cadets: don't auto-flag them as bad in the fallback heuristic.
    const bottom = unflaggedRanked
      .slice(-bottomN)
      .map((r) => r.s.id)
      .filter((id) => !isCadetLightDuty(id));

    await Promise.all([
      ...top.map((id) => setCadetFlag(id, 'good', 'ai')),
      ...bottom.map((id) => setCadetFlag(id, 'bad', 'ai')),
    ]);
  }, [overviewRanked, setCadetFlag, isCadetUnflagged, isCadetLightDuty]);

  const runAutoFlagAI = useCallback(async () => {
    if (cohort.length === 0) return;

    if (isAutoFlagCoolingDown) return;

    if (autoFlagState === 'loading') return;

    const nextAllowedAt = Date.now() + AUTO_FLAG_COOLDOWN_MS;
    setAutoFlagNextAllowedAtMs(nextAllowedAt);
    try {
      if (user?.uid) {
        await setDoc(
          doc(db, 'instructors', user.uid),
          {
            autoFlagNextAllowedAtMs: nextAllowedAt,
            autoFlagLastRunAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (e) {
      console.warn('Failed to persist auto-flag cooldown', e);
    }

    setAutoFlagState('loading');

    const apiUrl = `${process.env.EXPO_PUBLIC_BASE_URL || 'https://questfit.life'}/api/openai/auto-flag-cohort`;
    const rangeLabel = dateRange.type === 'custom'
      ? `${formatLocalIsoDate(dateRange.start)} to ${formatLocalIsoDate(dateRange.end)}`
      : dateRange.type;

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityMetric,
          rangeLabel,
          cohort: cohort.map((s) => ({
            cadetId: s.id,
            displayName: s.displayName,
            isLightDuty: isCadetLightDuty(s.id),
            avgSteps: s.avgSteps,
            avgDistance: s.avgDistance,
            avgCalories: s.avgCalories,
            avgSleep: s.avgSleep,
            avgHr: s.avgHr,
            lastSync: s.lastSync,
            trend: s.trend,
          })),
        }),
      });

      if (!resp.ok) throw new Error(`OpenAI auto-flag failed: ${resp.status}`);

      const data = await resp.json();
      const flags = Array.isArray(data?.flags) ? data.flags : [];
      if (flags.length === 0) throw new Error('OpenAI auto-flag returned no flags');

      await Promise.all(
        flags.map((f: any) => {
          const cadetId = typeof f?.cadetId === 'string' ? f.cadetId : '';
          const flag = f?.flag === 'good' || f?.flag === 'bad' || f?.flag === 'none' ? f.flag : 'none';
          const reason = typeof f?.reason === 'string' ? f.reason : '';
          if (!cadetId) return Promise.resolve();
          // Only fill currently-unflagged cadets; never modify manual or existing AI flags.
          if (!isCadetUnflagged(cadetId)) return Promise.resolve();
          if (flag !== 'good' && flag !== 'bad') return Promise.resolve();
          // Be more lenient for Light-Duty cadets: don't auto-flag them as bad.
          if (flag === 'bad' && isCadetLightDuty(cadetId)) return Promise.resolve();
          return setCadetFlag(cadetId, flag, 'ai', reason);
        })
      );

      setAutoFlagState('success_ai');
      await persistAutoFlagResult('success_ai');
    } catch (e) {
      console.warn('OpenAI auto-flag failed; falling back to simple heuristic', e);
      try {
        await runAutoFlagSimple();
        setAutoFlagState('success_fallback');
        await persistAutoFlagResult('success_fallback');
      } catch {
        setAutoFlagState('error');
        await persistAutoFlagResult('error');
      }
    }
  }, [cohort, activityMetric, dateRange, runAutoFlagSimple, setCadetFlag, autoFlagState, isCadetUnflagged, isAutoFlagCoolingDown, user?.uid, persistAutoFlagResult, isCadetLightDuty]);

  const flaggedGoodCadets = React.useMemo(() => {
    return cohort
      .filter((s) => getCadetFlag(s.id) === 'good')
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [cohort, cadetFlags]);

  const flaggedBadCadets = React.useMemo(() => {
    return cohort
      .filter((s) => getCadetFlag(s.id) === 'bad')
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [cohort, cadetFlags]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    const currentDate = selectedDate || (datePickerMode === 'start' ? dateRange.start : dateRange.end);

    const applyMobileClamp = (nextStart: Date, nextEnd: Date) => {
      if (Platform.OS === 'web') return { start: nextStart, end: nextEnd, clamped: false };

      const startDay = startOfLocalDay(nextStart);
      const endDay = startOfLocalDay(nextEnd);
      const diffDaysInclusive = Math.floor((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1;

      if (diffDaysInclusive > MOBILE_CUSTOM_MAX_DAYS) {
        return {
          start: nextStart,
          end: new Date(startDay.getTime() + (MOBILE_CUSTOM_MAX_DAYS - 1) * MS_PER_DAY),
          clamped: true,
        };
      }

      return { start: nextStart, end: nextEnd, clamped: false };
    };
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (datePickerMode === 'start') {
        setDateRange((prev) => {
          const nextStart = currentDate;
          let nextEnd = prev.end;

          if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
            nextEnd = nextStart;
          }

          const { start, end, clamped } = applyMobileClamp(nextStart, nextEnd);
          if (clamped) {
            Alert.alert('Range limited', `Custom range is limited to ${MOBILE_CUSTOM_MAX_DAYS} days on mobile.`);
          }
          return { ...prev, start, end, type: 'custom' };
        });
        // Small delay to allow the first picker to close completely
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 100);
      } else {
        setDateRange((prev) => {
          let nextStart = prev.start;
          let nextEnd = currentDate;

          if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
            nextStart = nextEnd;
          }

          const { start, end, clamped } = applyMobileClamp(nextStart, nextEnd);
          if (clamped) {
            Alert.alert('Range limited', `Custom range is limited to ${MOBILE_CUSTOM_MAX_DAYS} days on mobile.`);
          }
          return { ...prev, start, end, type: 'custom' };
        });
      }
    } else {
      // For iOS, we might want to handle this differently, but for now:
      setShowDatePicker(false); // Close on selection for simplicity
      if (datePickerMode === 'start') {
        setDateRange((prev) => {
          const nextStart = currentDate;
          let nextEnd = prev.end;

          if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
            nextEnd = nextStart;
          }

          const { start, end, clamped } = applyMobileClamp(nextStart, nextEnd);
          if (clamped) {
            Alert.alert('Range limited', `Custom range is limited to ${MOBILE_CUSTOM_MAX_DAYS} days on mobile.`);
          }
          return { ...prev, start, end, type: 'custom' };
        });
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 500);
      } else {
        setDateRange((prev) => {
          let nextStart = prev.start;
          let nextEnd = currentDate;

          if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
            nextStart = nextEnd;
          }

          const { start, end, clamped } = applyMobileClamp(nextStart, nextEnd);
          if (clamped) {
            Alert.alert('Range limited', `Custom range is limited to ${MOBILE_CUSTOM_MAX_DAYS} days on mobile.`);
          }
          return { ...prev, start, end, type: 'custom' };
        });
      }
    }
  };

  if (instructorLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!isInstructor) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Access Denied</Text>
        <Text>You must be an instructor to view this page.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, isCompactViewport && { paddingVertical: 10 }]}>
        {isWideWeb ? (
          <View style={styles.headerWideRow}>
            <View style={styles.headerLeftControls}>
              <View style={styles.rangeRowWideWeb}>
                <Text style={[styles.filterLabel, styles.filterLabelWeb]}>
                  Range:
                </Text>
                <View style={styles.rangeButtonsWideWeb}>
                  {quickRangeDays.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.rangeButton, dateRange.type === `${days}d` && styles.rangeButtonActive]}
                      onPress={() =>
                        setDateRange({
                          start: new Date(new Date().setDate(new Date().getDate() - (days - 1))),
                          end: new Date(),
                          type: `${days}d` as any,
                        })
                      }
                    >
                      <Text style={[styles.rangeButtonText, dateRange.type === `${days}d` && styles.rangeButtonTextActive]}>
                        {days}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.rangeButton, dateRange.type === 'custom' && styles.rangeButtonActive]}
                    onPress={() => {
                      setDatePickerMode('start');
                      setShowDatePicker(true);
                    }}
                  >
                    <Ionicons name="calendar" size={16} color={dateRange.type === 'custom' ? '#FFF' : '#666'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.headerCenterOverlay} pointerEvents="none">
              <Text style={[styles.title, styles.headerTitleWideWeb]} numberOfLines={1}>
                Instructor Dashboard
              </Text>
              <Text style={[styles.subtitle, styles.headerSubtitleWideWeb]}>
                {students.length} Cadets Enrolled
              </Text>
            </View>

            <View style={styles.headerRightControls}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsVisible(true)}>
                <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.selectButtonText}>Manage Cadets</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.headerTop}>
              <View style={styles.headerTopTitleWrap}>
                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Instructor Dashboard</Text>
              </View>
            </View>

            <Text style={styles.subtitle}>{students.length} Cadets Enrolled</Text>

            {/* Date Range Selector */}
          <View style={[styles.filterContainer, isCompactViewport && { paddingTop: 8, paddingBottom: 8 }]}
          >
            <View style={styles.rangeRow}>
              <Text style={[styles.filterLabel, styles.filterLabelMobile]}>
                Range:
              </Text>
              <View style={styles.rangeButtons}>
                {quickRangeDays.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.rangeButton, dateRange.type === `${days}d` && styles.rangeButtonActive]}
                    onPress={() =>
                      setDateRange({
                        start: new Date(new Date().setDate(new Date().getDate() - (days - 1))),
                        end: new Date(),
                        type: `${days}d` as any,
                      })
                    }
                  >
                    <Text style={[styles.rangeButtonText, dateRange.type === `${days}d` && styles.rangeButtonTextActive]}>
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.rangeButton, dateRange.type === 'custom' && styles.rangeButtonActive]}
                  onPress={() => {
                    setDatePickerMode('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar" size={16} color={dateRange.type === 'custom' ? '#FFF' : '#666'} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsVisible(true)}>
                <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.selectButtonText}>Manage Cadets</Text>
              </TouchableOpacity>
            </View>
          </View>
          </>
        )}

        <View style={[styles.modeToggleRow, isCompactViewport && { marginTop: 8, padding: 3 }]}>
          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              dashboardMode === 'overview' && styles.modeToggleBtnActive,
              isCompactViewport && { paddingVertical: 6 },
            ]}
            onPress={() => setDashboardMode('overview')}
          >
            <Text
              style={[
                styles.modeToggleText,
                dashboardMode === 'overview' && styles.modeToggleTextActive,
                isCompactViewport && { fontSize: 11 },
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              dashboardMode === 'cadets' && styles.modeToggleBtnActive,
              isCompactViewport && { paddingVertical: 6 },
            ]}
            onPress={() => setDashboardMode('cadets')}
          >
            <Text
              style={[
                styles.modeToggleText,
                dashboardMode === 'cadets' && styles.modeToggleTextActive,
                isCompactViewport && { fontSize: 11 },
              ]}
            >
              Cadets
            </Text>
          </TouchableOpacity>
        </View>

        {/* Only show search if we have items to search */}
        {dashboardMode === 'cadets' && displayedStudents.length > 0 && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={12} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tracked cadets..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
        )}
      </View>

      {dashboardMode === 'overview' ? (
        <ScrollView
          contentContainerStyle={styles.overviewContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        >
          {loading ? (
            <InstructorOverviewSkeleton />
          ) : cohortCount === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No cadets being tracked.</Text>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Select Cadets to View</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.overviewHeaderRow}>
                <Text style={styles.overviewTitle}>Cohort Overview</Text>
                <View style={styles.autoFlagWrap}>
                  <TouchableOpacity
                    style={[styles.autoFlagBtn, (autoFlagState === 'loading' || isAutoFlagCoolingDown) && styles.autoFlagBtnDisabled]}
                    onPress={runAutoFlagAI}
                    disabled={autoFlagState === 'loading' || isAutoFlagCoolingDown}
                  >
                  <Ionicons name="sparkles-outline" size={16} color="#FF6B35" />
                  <Text style={styles.autoFlagBtnText}>Auto-Flag</Text>
                  </TouchableOpacity>

                  {isAutoFlagCoolingDown && (
                    <Text style={styles.autoFlagCooldownText}>Wait {formatCooldown(autoFlagCooldownRemainingSec)}</Text>
                  )}

                  {autoFlagState === 'loading' && (
                    <ActivityIndicator size="small" color="#FF6B35" style={styles.autoFlagIndicator} />
                  )}
                  {autoFlagState === 'success_ai' && (
                    <Pressable
                      onHoverIn={() => showAutoFlagTooltip('Flags successfully generated')}
                      onHoverOut={hideAutoFlagTooltip}
                      style={styles.autoFlagIndicatorHover}
                      accessibilityLabel="Flags successfully generated"
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#00B894" style={styles.autoFlagIndicator} />
                      {Platform.OS === 'web' && autoFlagTooltipText && (
                        <View pointerEvents="none" style={styles.autoFlagTooltip}>
                          <Text style={styles.autoFlagTooltipText}>{autoFlagTooltipText}</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  {autoFlagState === 'success_fallback' && (
                    <Pressable
                      onHoverIn={() => showAutoFlagTooltip('Flags not geneerated, fallback onto algorithm')}
                      onHoverOut={hideAutoFlagTooltip}
                      style={styles.autoFlagIndicatorHover}
                      accessibilityLabel="Flags not geneerated, fallback onto algorithm"
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FDCB6E" style={styles.autoFlagIndicator} />
                      {Platform.OS === 'web' && autoFlagTooltipText && (
                        <View pointerEvents="none" style={styles.autoFlagTooltip}>
                          <Text style={styles.autoFlagTooltipText}>{autoFlagTooltipText}</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  {autoFlagState === 'error' && (
                    <Pressable
                      onHoverIn={() => showAutoFlagTooltip('Flags failed to generate')}
                      onHoverOut={hideAutoFlagTooltip}
                      style={styles.autoFlagIndicatorHover}
                      accessibilityLabel="Flags failed to generate"
                    >
                      <Ionicons name="alert-circle" size={18} color="#D63031" style={styles.autoFlagIndicator} />
                      {Platform.OS === 'web' && autoFlagTooltipText && (
                        <View pointerEvents="none" style={styles.autoFlagTooltip}>
                          <Text style={styles.autoFlagTooltipText}>{autoFlagTooltipText}</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{activityMetric === 'steps' ? 'Avg Steps' : 'Avg Distance (m)'}</Text>
                  <Text style={styles.summaryValue}>
                    {formatMobileCompactNumber(activityMetric === 'steps' ? cohortAverages.avgSteps : cohortAverages.avgDistance)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Avg Calories</Text>
                  <Text style={styles.summaryValue}>{formatMobileCompactNumber(cohortAverages.avgCalories)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Avg HR</Text>
                  <Text style={styles.summaryValue}>{cohortAverages.avgHr > 0 ? cohortAverages.avgHr : '-'}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Avg Sleep Quality /100</Text>
                  <Text style={styles.summaryValue}>{cohortAverages.avgSleep > 0 ? cohortAverages.avgSleep : '-'}</Text>
                </View>
              </View>

              <View style={styles.flagRow}>
                <View style={[styles.flagPill, styles.flagPillGood]}>
                  <Ionicons name="thumbs-up" size={14} color="#00B894" />
                  <Text style={[styles.flagPillText, styles.flagPillTextGood]}>{flaggedCounts.good} good</Text>
                </View>
                <View style={[styles.flagPill, styles.flagPillBad]}>
                  <Ionicons name="thumbs-down" size={14} color="#D63031" />
                  <Text style={[styles.flagPillText, styles.flagPillTextBad]}>{flaggedCounts.bad} needs attention</Text>
                </View>
                <View style={[styles.flagPill, styles.flagPillNone]}>
                  <Ionicons name="remove-outline" size={14} color="#636E72" />
                  <Text style={[styles.flagPillText, styles.flagPillTextNone]}>{flaggedCounts.none} unflagged</Text>
                </View>
              </View>

              <View style={styles.syncInfoRow}>
                <Ionicons name="sync-outline" size={16} color="#636E72" />
                <Text style={styles.syncInfoText}>
                  {cohortAverages.recentSyncCount}/{cohortCount} synced in last 24h
                </Text>
              </View>

              <View style={styles.overviewLists}>
                <View style={[styles.overviewListCard, styles.overviewListCardGood]}>
                  <Text style={[styles.listTitle, styles.listTitleGood]}>Top Performers</Text>
                  {flaggedGoodCadets.length === 0 ? (
                    <Text style={styles.emptyListHint}>No cadets flagged as good yet.</Text>
                  ) : (
                    flaggedGoodCadets.slice(0, 6).map((s) => (
                      <View key={s.id} style={styles.overviewCadetRow}>
                        <View style={styles.overviewCadetTextCol}>
                          <View style={styles.overviewCadetNameRow}>
                            <Text style={styles.overviewCadetName}>{s.displayName}</Text>
                          </View>
                          <View style={styles.overviewCadetMetaRow}>
                            <Text style={styles.overviewCadetMeta}>
                              {formatMobileCompactNumber(activityMetric === 'steps' ? s.avgSteps : s.avgDistance)}
                              {activityMetric === 'steps' ? ' steps' : ' m'}
                              {'  •  '}
                              {formatMobileCompactNumber(s.avgCalories)} kcal
                              {'  •  '}
                              {s.avgSleep > 0 ? `${s.avgSleep} sleep` : 'sleep -'}
                              {'  •  '}
                              {formatLastSyncShort(s.lastSync)}
                              {getCadetFlagSource(s.id) === 'ai' ? '  |' : ''}
                            </Text>

                            {getCadetFlagSource(s.id) === 'ai' && (
                              <View style={styles.aiReasonRow}>
                                <View style={styles.aiFlagBadge}>
                                  <Ionicons name="sparkles" size={10} color="#636E72" />
                                  <Text style={styles.aiFlagBadgeText}>AI</Text>
                                </View>
                                <Text style={styles.aiFlagReasonText} numberOfLines={2}>
                                  {getCadetFlagReason(s.id) || 'Auto-flagged'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.overviewCadetActions}>
                          <TouchableOpacity
                            style={[styles.flagActionBtn, getCadetFlag(s.id) === 'good' && styles.flagActionBtnActiveGood]}
                            onPress={() => setCadetFlag(s.id, 'none', 'manual')}
                          >
                            <Ionicons name="thumbs-up" size={16} color="#00B894" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.flagActionBtn, getCadetFlag(s.id) === 'bad' && styles.flagActionBtnActiveBad]}
                            onPress={() => setCadetFlag(s.id, 'bad', 'manual')}
                          >
                            <Ionicons name="thumbs-down" size={16} color="#D63031" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={[styles.overviewListCard, styles.overviewListCardBad]}>
                  <Text style={[styles.listTitle, styles.listTitleBad]}>Needs Attention</Text>
                  {flaggedBadCadets.length === 0 ? (
                    <Text style={styles.emptyListHint}>No cadets flagged as needing attention yet.</Text>
                  ) : (
                    flaggedBadCadets.slice(0, 6).map((s) => (
                      <View key={s.id} style={styles.overviewCadetRow}>
                        <View style={styles.overviewCadetTextCol}>
                          <View style={styles.overviewCadetNameRow}>
                            <Text style={styles.overviewCadetName}>{s.displayName}</Text>
                          </View>
                          <View style={styles.overviewCadetMetaRow}>
                            <Text style={styles.overviewCadetMeta}>
                              {formatMobileCompactNumber(activityMetric === 'steps' ? s.avgSteps : s.avgDistance)}
                              {activityMetric === 'steps' ? ' steps' : ' m'}
                              {'  •  '}
                              {formatMobileCompactNumber(s.avgCalories)} kcal
                              {'  •  '}
                              {s.avgSleep > 0 ? `${s.avgSleep} sleep` : 'sleep -'}
                              {'  •  '}
                              {formatLastSyncShort(s.lastSync)}
                              {getCadetFlagSource(s.id) === 'ai' ? '  |' : ''}
                            </Text>

                            {getCadetFlagSource(s.id) === 'ai' && (
                              <View style={styles.aiReasonRow}>
                                <View style={styles.aiFlagBadge}>
                                  <Ionicons name="sparkles" size={10} color="#636E72" />
                                  <Text style={styles.aiFlagBadgeText}>AI</Text>
                                </View>
                                <Text style={styles.aiFlagReasonText} numberOfLines={2}>
                                  {getCadetFlagReason(s.id) || 'Auto-flagged'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.overviewCadetActions}>
                          <TouchableOpacity
                            style={[styles.flagActionBtn, getCadetFlag(s.id) === 'good' && styles.flagActionBtnActiveGood]}
                            onPress={() => setCadetFlag(s.id, 'good', 'manual')}
                          >
                            <Ionicons name="thumbs-up" size={16} color="#00B894" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.flagActionBtn, getCadetFlag(s.id) === 'bad' && styles.flagActionBtnActiveBad]}
                            onPress={() => setCadetFlag(s.id, 'none', 'manual')}
                          >
                            <Ionicons name="thumbs-down" size={16} color="#D63031" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {(flaggedGoodCadets.length === 0 && flaggedBadCadets.length === 0) && (
                <Text style={styles.emptyListHintCenter}>
                  No flags yet. Use Auto-Flag or tap thumbs to flag cadets.
                </Text>
              )}

              <Text style={styles.overviewHint}>
                Tip: Switch to “Cadets” to see the full list.
              </Text>
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={
            loading
              ? ([1, 2, 3] as const)
              : displayedStudents.filter(s => s.displayName.toLowerCase().includes(normalizedSearchQuery.toLowerCase()))
          }
          renderItem={({ item }) =>
            loading ? (
              <StudentCardSkeleton />
            ) : (
              <StudentCard
                item={item as any}
                isSelectionMode={false}
                chartConfig={chartConfig}
                activityMetric={activityMetric}
                rangeDays={selectedRangeDays}
                flag={getCadetFlag((item as any).id)}
                flagSource={getCadetFlagSource((item as any).id)}
                onChangeFlag={(nextFlag) => setCadetFlag((item as any).id, nextFlag, 'manual')}
                isLightDuty={isCadetLightDuty((item as any).id)}
              />
            )
          }
          keyExtractor={(item: any) => (loading ? `skeleton-${String(item)}` : item.id)}
          contentContainerStyle={[
            styles.listContent,
            isCompactViewport && { paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No cadets being tracked.</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Select Cadets to View</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      {/* Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cadets</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={students}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.modalItemRow}>
                  <TouchableOpacity
                    style={[styles.modalItem, styles.modalItemLeft]}
                    onPress={() => toggleUser(item.id)}
                  >
                    <View style={[styles.checkbox, selectedIds.includes(item.id) && styles.checkboxSelected]}>
                      {selectedIds.includes(item.id) && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <Text style={styles.modalItemText}>{item.displayName}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ldPill, isCadetLightDuty(item.id) && styles.ldPillActive]}
                    onPress={() => setCadetLightDutyStatus(item.id, !isCadetLightDuty(item.id))}
                    accessibilityRole="button"
                    accessibilityLabel={isCadetLightDuty(item.id) ? 'Unset light duty' : 'Set light duty'}
                  >
                    <Text style={[styles.ldPillText, isCadetLightDuty(item.id) && styles.ldPillTextActive]}>LD</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.settingsModalContent]}>
            <View style={styles.settingsModalHeader}>
              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close chart settings"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.settingsModalClose}
              >
                <Ionicons name="chevron-down" size={30} color="#FF6B35" />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Chart Settings</Text>
            </View>
            
            <ScrollView style={styles.settingsContent} contentContainerStyle={styles.settingsContentContainer}>
              <Text style={styles.sectionTitle}>Customize Graphs</Text>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Activity Metric</Text>
                <View style={styles.typeSelector}>
                  {([
                    { label: 'Steps', value: 'steps' },
                    { label: 'Distance (m)', value: 'distance' },
                  ] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.typeOption,
                        activityMetric === opt.value && styles.typeOptionSelected,
                      ]}
                      onPress={() => setActivityMetric(opt.value)}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          activityMetric === opt.value && styles.typeOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(['distance', 'hr', 'sleep', 'calories'] as const).map((metric) => {
                const type = chartConfig[metric];
                return (
                  <View key={metric} style={styles.settingRow}>
                    <Text style={styles.settingLabel}>
                      {metric === 'hr'
                        ? 'Heart Rate'
                        : metric === 'calories'
                          ? 'Calories'
                          : metric.charAt(0).toUpperCase() + metric.slice(1)}
                    </Text>
                    <View style={styles.typeSelector}>
                      {(['line', 'bar', 'area', 'scatter'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeOption, type === t && styles.typeOptionSelected]}
                          onPress={() => setChartConfig((prev) => ({ ...prev, [metric]: t }))}
                        >
                          <Text style={[styles.typeOptionText, type === t && styles.typeOptionTextSelected]}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Web Date Picker Modal */}
      {Platform.OS === 'web' && showDatePicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.webModalOverlay}>
            <View style={styles.webModalContent}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              
              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>Start:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: formatLocalIsoDate(dateRange.start instanceof Date ? dateRange.start : new Date()),
                  onChange: (e: any) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setDateRange((prev) => {
                        const nextStart = date;
                        let nextEnd = prev.end;

                        if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
                          nextEnd = nextStart;
                        }

                        if (isCompactRange) {
                          const startDay = startOfLocalDay(nextStart);
                          const endDay = startOfLocalDay(nextEnd);
                          const diffDaysInclusive = Math.floor((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1;
                          if (diffDaysInclusive > MOBILE_CUSTOM_MAX_DAYS) {
                            nextEnd = new Date(startDay.getTime() + (MOBILE_CUSTOM_MAX_DAYS - 1) * MS_PER_DAY);
                          }
                        }

                        return { ...prev, start: nextStart, end: nextEnd, type: 'custom' };
                      });
                    }
                  },
                  style: WEB_DATE_INPUT_STYLE,
                })}
              </View>

              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>End:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: formatLocalIsoDate(dateRange.end instanceof Date ? dateRange.end : new Date()),
                  onChange: (e: any) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setDateRange((prev) => {
                        let nextStart = prev.start;
                        const nextEnd = date;

                        if (startOfLocalDay(nextEnd).getTime() < startOfLocalDay(nextStart).getTime()) {
                          nextStart = nextEnd;
                        }

                        let finalEnd = nextEnd;
                        if (isCompactRange) {
                          const startDay = startOfLocalDay(nextStart);
                          const endDay = startOfLocalDay(nextEnd);
                          const diffDaysInclusive = Math.floor((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1;
                          if (diffDaysInclusive > MOBILE_CUSTOM_MAX_DAYS) {
                            finalEnd = new Date(startDay.getTime() + (MOBILE_CUSTOM_MAX_DAYS - 1) * MS_PER_DAY);
                          }
                        }

                        return { ...prev, start: nextStart, end: finalEnd, type: 'custom' };
                      });
                    }
                  },
                  style: WEB_DATE_INPUT_STYLE,
                })}
              </View>

              <TouchableOpacity 
                style={styles.webApplyButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.webApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Native Date Picker */}
      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? (dateRange.start instanceof Date ? dateRange.start : new Date()) : (dateRange.end instanceof Date ? dateRange.end : new Date())}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

function InstructorOverviewSkeleton() {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.overviewHeaderRow}>
        <SkeletonBlock width={160} height={18} radius={10} />
        <View style={styles.autoFlagWrap}>
          <View style={[styles.autoFlagBtn, { backgroundColor: '#E0E0E0' }]}
          >
            <SkeletonBlock width={14} height={14} radius={7} />
            <SkeletonBlock width={70} height={12} radius={6} style={{ marginLeft: 8 }} />
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={`sum-skel-${idx}`} style={styles.summaryCard}>
            <SkeletonBlock width={'70%'} height={10} radius={6} />
            <SkeletonBlock width={'45%'} height={18} radius={10} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>

      <View style={styles.flagRow}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <View key={`pill-skel-${idx}`} style={[styles.flagPill, { backgroundColor: '#EDEDED' }]}>
            <SkeletonBlock width={14} height={14} radius={7} />
            <SkeletonBlock width={90} height={10} radius={6} style={{ marginLeft: 8 }} />
          </View>
        ))}
      </View>

      <View style={styles.syncInfoRow}>
        <SkeletonBlock width={16} height={16} radius={8} />
        <SkeletonBlock width={190} height={12} radius={6} style={{ marginLeft: 8 }} />
      </View>

      <View style={styles.overviewLists}>
        {Array.from({ length: 2 }).map((_, cardIdx) => (
          <View key={`list-card-skel-${cardIdx}`} style={styles.overviewListCard}>
            <SkeletonBlock width={140} height={14} radius={8} style={{ marginBottom: 12 }} />
            {Array.from({ length: 4 }).map((__, rowIdx) => (
              <View key={`row-skel-${cardIdx}-${rowIdx}`} style={styles.overviewCadetRow}>
                <View style={styles.overviewCadetTextCol}>
                  <SkeletonBlock width={160} height={12} radius={6} />
                  <SkeletonBlock width={'90%'} height={10} radius={6} style={{ marginTop: 8 }} />
                </View>
                <View style={styles.overviewCadetActions}>
                  <SkeletonBlock width={28} height={28} radius={14} />
                  <SkeletonBlock width={28} height={28} radius={14} style={{ marginLeft: 10 }} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
