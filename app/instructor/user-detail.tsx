import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Text } from '@/components/Themed';
import { useLocalSearchParams, router } from 'expo-router';
import { db } from '@/src/services/firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useInstructorStudents } from '@/src/hooks/useInstructorStudents';
import { useAuth } from '@/src/hooks/useAuth';
import { ComparisonRadarChart, RadarDataPoint } from '@/components/instr-dashboard/ComparisonRadarChart';

// Helper function to convert ISO8601 duration to readable format
function formatDuration(iso8601Duration: string): string {
  if (!iso8601Duration) return 'N/A';
  
  const match = iso8601Duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return iso8601Duration;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${Math.round(seconds)}s`);
  
  return parts.length > 0 ? parts.join(' ') : '0s';
}

interface UserStats {
  today: {
    activity?: any;
    cardioLoad?: any;
    sleep?: any;
    nightlyRecharge?: any;
    exercises?: any;
    continuousHR?: any;
  };
  historical: {
    avgActivity?: any;
    avgCardioLoad?: number;
    avgSleep?: any;
    recentExercises?: any[];
  };
}

interface AISummary {
  insights: string;
  recommendations: string;
  "[short]insights": string;
  "[short]recommendations": string;
}

type PresetRange = '7d' | '14d' | '30d';
type DateRange = {
  type: PresetRange | 'custom';
  start: Date;
  end: Date;
};

type RangeDailyItem = {
  date: string; // YYYY-MM-DD
  activity?: any;
  exercises?: any;
  sleep?: any;
  steps?: number;
  activityCalories?: number;
  activityDistance?: number;
  exerciseCount?: number;
  exerciseCalories?: number;
  exerciseDistance?: number;
  sleepScore?: number;
  sleepStart?: string;
  sleepEnd?: string;
  sleepDurationMinutes?: number;
};

export default function UserDetailScreen() {
  const { userId, date } = useLocalSearchParams<{ userId: string, date?: string }>();
  const { user } = useAuth();
  const { selectedUserIds } = useInstructorStudents(user?.uid);
  
  const [stats, setStats] = useState<UserStats | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{time: string, hr: number} | null>(null);

  // Radar chart state
  const [individualRadarData, setIndividualRadarData] = useState<RadarDataPoint | null>(null);
  const [averageRadarData, setAverageRadarData] = useState<RadarDataPoint | null>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [selectedCadetsCount, setSelectedCadetsCount] = useState(0);

  const initialEnd = useMemo(() => {
    const parsed = date ? new Date(date) : new Date();
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [date]);

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date(initialEnd);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { type: '7d', start, end };
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  const [rangeItems, setRangeItems] = useState<RangeDailyItem[]>([]);
  const [loadingRange, setLoadingRange] = useState(false);

  const selectedDate = useMemo(() => {
    // Use the end of the range as the "selected day" for single-day sections (AI, cardio, etc.)
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const endMs = Math.max(start.getTime(), end.getTime());
    return new Date(endMs);
  }, [dateRange]);
  
  // AI State
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUserStats();
      checkExistingAISummary();
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const name = typeof data.displayName === 'string' ? data.displayName.trim() : '';
          setDisplayName(name || userId);
        } else {
          setDisplayName(userId);
        }
      } catch (e) {
        console.warn('Failed to load user profile', e);
        setDisplayName(userId);
      }
    };
    loadProfile();
  }, [userId]);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toIsoDateString = (d: Date) => d.toISOString().split('T')[0];

  const dateStrings = useMemo(() => {
    const dates: string[] = [];

    const maxDays = 90;
    const msPerDay = 24 * 60 * 60 * 1000;

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (dateRange.type !== 'custom') {
      const days = dateRange.type === '7d' ? 7 : dateRange.type === '14d' ? 14 : 30;
      const endDate = new Date(end);
      for (let i = 0; i < days; i++) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - i);
        dates.push(toIsoDateString(d));
      }
      return dates;
    }

    const startMs = Math.min(start.getTime(), end.getTime());
    const endMs = Math.max(start.getTime(), end.getTime());
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    const boundedCount = Math.min(dayCount, maxDays);

    for (let i = 0; i < boundedCount; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      dates.push(toIsoDateString(d));
    }

    return dates;
  }, [dateRange]);

  const onDateChange = (event: any, picked?: Date) => {
    if (event?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    const currentDate = picked || (datePickerMode === 'start' ? dateRange.start : dateRange.end);
    if (!currentDate || isNaN(currentDate.getTime())) return;

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (datePickerMode === 'start') {
        setDateRange((prev) => ({ ...prev, start: currentDate, type: 'custom' }));
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 100);
      } else {
        setDateRange((prev) => ({ ...prev, end: currentDate, type: 'custom' }));
      }
    } else {
      // iOS: close on selection, then optionally open end picker
      setShowDatePicker(false);
      if (datePickerMode === 'start') {
        setDateRange((prev) => ({ ...prev, start: currentDate, type: 'custom' }));
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 500);
      } else {
        setDateRange((prev) => ({ ...prev, end: currentDate, type: 'custom' }));
      }
    }
  };

  // Fetch radar data for a single user
  const fetchUserRadarData = async (uid: string, datesToCheck: string[]): Promise<RadarDataPoint> => {
    const [activityDocs, exercisesDocs, sleepDocs, cardioLoadDocs] = await Promise.all([
      Promise.all(datesToCheck.map(date =>
        getDoc(doc(db, `users/${uid}/polarData/activities/all/${date}`))
      )),
      Promise.all(datesToCheck.map(date =>
        getDoc(doc(db, `users/${uid}/polarData/exercises/all/${date}`))
      )),
      Promise.all(datesToCheck.map(date =>
        getDoc(doc(db, `users/${uid}/polarData/sleep/all/${date}`))
      )),
      Promise.all(datesToCheck.map(date =>
        getDoc(doc(db, `users/${uid}/polarData/cardioLoad/all/${date}`))
      )),
    ]);

    let totalSteps = 0, stepsCount = 0;
    let totalCalories = 0, caloriesCount = 0;
    let totalDistance = 0, distanceCount = 0;
    let totalSleepScore = 0, sleepCount = 0;
    let totalCardioLoad = 0, cardioCount = 0;
    let totalExerciseCount = 0, exerciseDays = 0;

    datesToCheck.forEach((_, index) => {
      // Activity data
      const activityDoc = activityDocs[index];
      if (activityDoc?.exists()) {
        const data = activityDoc.data();
        if (typeof data?.steps === 'number' && data.steps > 0) {
          totalSteps += data.steps;
          stepsCount++;
        }
        const cals = data?.calories ?? data?.active_calories;
        if (typeof cals === 'number' && cals > 0) {
          totalCalories += cals;
          caloriesCount++;
        }
        const dist = data?.distance_from_steps ?? data?.distance;
        if (typeof dist === 'number' && dist > 0) {
          totalDistance += dist;
          distanceCount++;
        }
      }

      // Exercise data
      const exerciseDoc = exercisesDocs[index];
      if (exerciseDoc?.exists()) {
        const data = exerciseDoc.data();
        if (data?.exercises && Array.isArray(data.exercises) && data.exercises.length > 0) {
          totalExerciseCount += data.exercises.length;
          exerciseDays++;
        } else if (typeof data?.count === 'number' && data.count > 0) {
          totalExerciseCount += data.count;
          exerciseDays++;
        }
      }

      // Sleep data
      const sleepDoc = sleepDocs[index];
      if (sleepDoc?.exists()) {
        const sleepScore = sleepDoc.data()?.sleep_score;
        if (typeof sleepScore === 'number' && sleepScore > 0) {
          totalSleepScore += sleepScore;
          sleepCount++;
        }
      }

      // Cardio load data
      const cardioDoc = cardioLoadDocs[index];
      if (cardioDoc?.exists()) {
        const cardioLoadRatio = cardioDoc.data()?.data?.cardio_load_ratio;
        if (typeof cardioLoadRatio === 'number' && cardioLoadRatio > 0) {
          totalCardioLoad += cardioLoadRatio;
          cardioCount++;
        }
      }
    });

    return {
      steps: stepsCount > 0 ? Math.round(totalSteps / stepsCount) : 0,
      calories: caloriesCount > 0 ? Math.round(totalCalories / caloriesCount) : 0,
      distance: distanceCount > 0 ? Math.round(totalDistance / distanceCount) : 0,
      sleepScore: sleepCount > 0 ? Math.round(totalSleepScore / sleepCount) : 0,
      cardioLoad: cardioCount > 0 ? totalCardioLoad / cardioCount : 0,
      exerciseCount: exerciseDays > 0 ? totalExerciseCount / exerciseDays : 0,
    };
  };

  // Load radar chart data
  const loadRadarData = useCallback(async () => {
    if (!userId) return;
    
    setLoadingRadar(true);
    try {
      // Fetch individual user's radar data
      const individualData = await fetchUserRadarData(userId, dateStrings);
      setIndividualRadarData(individualData);

      // Determine which users to include in average calculation
      const usersForAverage = selectedUserIds.length > 0 ? selectedUserIds : [userId];
      
      // Fetch all users' data and calculate average
      const allUsersData = await Promise.all(
        usersForAverage.map(uid => fetchUserRadarData(uid, dateStrings))
      );

      setSelectedCadetsCount(usersForAverage.length);

      // Calculate average across all users
      const avgData: RadarDataPoint = {
        steps: 0,
        calories: 0,
        distance: 0,
        sleepScore: 0,
        cardioLoad: 0,
        exerciseCount: 0,
      };

      if (allUsersData.length > 0) {
        allUsersData.forEach(userData => {
          avgData.steps += userData.steps;
          avgData.calories += userData.calories;
          avgData.distance += userData.distance;
          avgData.sleepScore += userData.sleepScore;
          avgData.cardioLoad += userData.cardioLoad;
          avgData.exerciseCount += userData.exerciseCount;
        });

        const count = allUsersData.length;
        avgData.steps = Math.round(avgData.steps / count);
        avgData.calories = Math.round(avgData.calories / count);
        avgData.distance = Math.round(avgData.distance / count);
        avgData.sleepScore = Math.round(avgData.sleepScore / count);
        avgData.cardioLoad = avgData.cardioLoad / count;
        avgData.exerciseCount = avgData.exerciseCount / count;
      }

      setAverageRadarData(avgData);
    } catch (error) {
      console.error('Error loading radar data:', error);
    } finally {
      setLoadingRadar(false);
    }
  }, [userId, selectedUserIds, dateStrings]);

  // Load radar data when date range or user changes
  useEffect(() => {
    loadRadarData();
  }, [loadRadarData]);

  const loadRange = useCallback(async () => {
    if (!userId) return;
    setLoadingRange(true);
    try {
      const results = await Promise.all(
        dateStrings.map(async (ds) => {
          const [activitySnap, exercisesSnap, sleepSnap] = await Promise.all([
            getDoc(doc(db, `users/${userId}/polarData/activities/all/${ds}`)),
            getDoc(doc(db, `users/${userId}/polarData/exercises/all/${ds}`)),
            getDoc(doc(db, `users/${userId}/polarData/sleep/all/${ds}`)),
          ]);

          const activity = activitySnap.exists() ? activitySnap.data() : undefined;
          const exercises = exercisesSnap.exists() ? exercisesSnap.data() : undefined;
          const sleep = sleepSnap.exists() ? sleepSnap.data() : undefined;

          const steps = typeof activity?.steps === 'number' ? activity.steps : undefined;
          const activityCalories =
            typeof activity?.calories === 'number'
              ? activity.calories
              : typeof activity?.active_calories === 'number'
                ? activity.active_calories
                : undefined;
          const activityDistance =
            typeof activity?.distance_from_steps === 'number'
              ? activity.distance_from_steps
              : typeof activity?.distance === 'number'
                ? activity.distance
                : undefined;

          let exerciseCount: number | undefined;
          let exerciseCalories: number | undefined;
          let exerciseDistance: number | undefined;
          if (exercises?.exercises && Array.isArray(exercises.exercises)) {
            exerciseCount = exercises.exercises.length;
            let totalCals = 0;
            let totalDist = 0;
            exercises.exercises.forEach((ex: any) => {
              if (typeof ex?.calories === 'number') totalCals += ex.calories;
              if (typeof ex?.distance === 'number') totalDist += ex.distance;
            });
            exerciseCalories = Math.round(totalCals);
            exerciseDistance = Math.round(totalDist);
          } else if (typeof exercises?.count === 'number') {
            exerciseCount = exercises.count;
          }

          const sleepScore = typeof sleep?.sleep_score === 'number' ? sleep.sleep_score : undefined;
          const sleepStart = typeof sleep?.sleep_start_time === 'string' ? sleep.sleep_start_time : undefined;
          const sleepEnd = typeof sleep?.sleep_end_time === 'string' ? sleep.sleep_end_time : undefined;
          let sleepDurationMinutes: number | undefined;
          if (sleepStart && sleepEnd) {
            const start = new Date(sleepStart);
            const end = new Date(sleepEnd);
            const ms = end.getTime() - start.getTime();
            if (Number.isFinite(ms) && ms > 0) sleepDurationMinutes = Math.round(ms / 60000);
          }

          return {
            date: ds,
            activity,
            exercises,
            sleep,
            steps,
            activityCalories,
            activityDistance,
            exerciseCount,
            exerciseCalories,
            exerciseDistance,
            sleepScore,
            sleepStart,
            sleepEnd,
            sleepDurationMinutes,
          } satisfies RangeDailyItem;
        })
      );
      setRangeItems(results);
    } catch (e) {
      console.warn('Failed to load range data', e);
      setRangeItems([]);
    } finally {
      setLoadingRange(false);
    }
  }, [dateStrings, userId]);

  const checkExistingAISummary = async () => {
    if (!userId) return;
    try {
      const dateStr = formatDate(selectedDate);
      const summaryDoc = await getDoc(doc(db, `users/${userId}/openAIGen/${dateStr}`));
      if (summaryDoc.exists()) {
        setAiSummary(summaryDoc.data() as AISummary);
      } else {
        setAiSummary(null);
      }
    } catch (error) {
      console.log("No existing summary found");
      setAiSummary(null);
    }
  };

  const generateInsights = async () => {
    if (!userId) return;
    setLoadingAI(true);
    try {
      // Use Vercel production URL by default
      const apiUrl = `${process.env.EXPO_PUBLIC_BASE_URL || 'https://questfit.life'}/api/openai/generate-summary`;

      const dateStr = formatDate(selectedDate);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          date: dateStr,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to generate insights';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setAiSummary(data);
    } catch (error: any) {
      console.error('Error generating insights:', error);
      alert(error.message || 'Failed to generate insights. Please try again.');
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadRange();
  }, [userId, loadRange]);

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const loadUserStats = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const userStats: UserStats = {
        today: {},
        historical: {},
      };

      const dateStr = formatDate(selectedDate);

      // Get selected date's data
      const todayActivity = await getDoc(
        doc(db, `users/${userId}/polarData/activities/all/${dateStr}`)
      );
      if (todayActivity.exists()) {
        userStats.today.activity = todayActivity.data();
      }

      const todayCardio = await getDoc(
        doc(db, `users/${userId}/polarData/cardioLoad/all/${dateStr}`)
      );
      if (todayCardio.exists()) {
        userStats.today.cardioLoad = todayCardio.data();
      }

      const todaySleep = await getDoc(
        doc(db, `users/${userId}/polarData/sleep/all/${dateStr}`)
      );
      if (todaySleep.exists()) {
        userStats.today.sleep = todaySleep.data();
      }

      const todayRecharge = await getDoc(
        doc(db, `users/${userId}/polarData/nightlyRecharge/all/${dateStr}`)
      );
      if (todayRecharge.exists()) {
        userStats.today.nightlyRecharge = todayRecharge.data();
      }

      const todayExercises = await getDoc(
        doc(db, `users/${userId}/polarData/exercises/all/${dateStr}`)
      );
      if (todayExercises.exists()) {
        userStats.today.exercises = todayExercises.data();
      }

      const todayHR = await getDoc(
        doc(db, `users/${userId}/polarData/continuousHeartRate/all/${dateStr}`)
      );
      if (todayHR.exists()) {
        userStats.today.continuousHR = todayHR.data();
      }

      // Get historical data (last 7 days)
      const exercisesQuery = query(
        collection(db, `users/${userId}/polarData/exercises/all`),
        orderBy('date', 'desc'),
        limit(7)
      );
      const exercisesSnapshot = await getDocs(exercisesQuery);
      userStats.historical.recentExercises = exercisesSnapshot.docs.map(doc => ({
        date: doc.id,
        ...doc.data(),
      }));

      // Calculate historical averages
      const activityQuery = query(
        collection(db, `users/${userId}/polarData/activities/all`),
        orderBy('date', 'desc'),
        limit(7)
      );
      const activitySnapshot = await getDocs(activityQuery);
      const activityDocs = activitySnapshot.docs.map(d => d.data());
      
      if (activityDocs.length > 0) {
        const totalSteps = activityDocs.reduce((sum, d) => sum + (d.steps || 0), 0);
        const totalCalories = activityDocs.reduce((sum, d) => sum + (d.calories || 0), 0);
        userStats.historical.avgActivity = {
          steps: Math.round(totalSteps / activityDocs.length),
          calories: Math.round(totalCalories / activityDocs.length),
        };
      }

      const cardioQuery = query(
        collection(db, `users/${userId}/polarData/cardioLoad/all`),
        orderBy('date', 'desc'),
        limit(7)
      );
      const cardioSnapshot = await getDocs(cardioQuery);
      const cardioDocs = cardioSnapshot.docs.map(d => d.data());
      
      if (cardioDocs.length > 0) {
        const totalCardio = cardioDocs.reduce(
          (sum, d) => sum + (d.data?.cardio_load_ratio || 0),
          0
        );
        userStats.historical.avgCardioLoad = totalCardio / cardioDocs.length;
      }

      setStats(userStats);
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserStats(), checkExistingAISummary(), loadRange(), loadRadarData()]);
    setRefreshing(false);
  };

  const rangeLabel = useMemo(() => {
    if (dateRange.type !== 'custom') {
      return dateRange.type === '7d' ? 'Last 7 days' : dateRange.type === '14d' ? 'Last 14 days' : 'Last 30 days';
    }
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const startMs = Math.min(start.getTime(), end.getTime());
    const endMs = Math.max(start.getTime(), end.getTime());
    return `${new Date(startMs).toLocaleDateString()} – ${new Date(endMs).toLocaleDateString()}`;
  }, [dateRange]);

  const activityAgg = useMemo(() => {
    let days = 0;
    let stepsTotal = 0;
    let caloriesTotal = 0;
    let distanceTotal = 0;
    rangeItems.forEach((it) => {
      const hasAny = typeof it.steps === 'number' || typeof it.activityCalories === 'number' || typeof it.activityDistance === 'number';
      if (!hasAny) return;
      days += 1;
      if (typeof it.steps === 'number') stepsTotal += it.steps;
      if (typeof it.activityCalories === 'number') caloriesTotal += it.activityCalories;
      if (typeof it.activityDistance === 'number') distanceTotal += it.activityDistance;
    });
    return { days, stepsTotal, caloriesTotal, distanceTotal };
  }, [rangeItems]);

  const exerciseAgg = useMemo(() => {
    let days = 0;
    let workoutTotal = 0;
    let caloriesTotal = 0;
    let distanceTotal = 0;
    rangeItems.forEach((it) => {
      const hasAny = typeof it.exerciseCount === 'number' || typeof it.exerciseCalories === 'number' || typeof it.exerciseDistance === 'number';
      if (!hasAny) return;
      days += 1;
      if (typeof it.exerciseCount === 'number') workoutTotal += it.exerciseCount;
      if (typeof it.exerciseCalories === 'number') caloriesTotal += it.exerciseCalories;
      if (typeof it.exerciseDistance === 'number') distanceTotal += it.exerciseDistance;
    });
    return { days, workoutTotal, caloriesTotal, distanceTotal };
  }, [rangeItems]);

  const sleepAgg = useMemo(() => {
    let days = 0;
    let scoreTotal = 0;
    let durationTotal = 0;
    rangeItems.forEach((it) => {
      const hasAny = typeof it.sleepScore === 'number' || typeof it.sleepDurationMinutes === 'number';
      if (!hasAny) return;
      days += 1;
      if (typeof it.sleepScore === 'number') scoreTotal += it.sleepScore;
      if (typeof it.sleepDurationMinutes === 'number') durationTotal += it.sleepDurationMinutes;
    });
    return { days, scoreTotal, durationTotal };
  }, [rangeItems]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{displayName || userId}</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{displayName || userId}</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.controlsCard}>
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Range:</Text>
          <View style={styles.rangeButtons}>
            {[7, 14, 30].map((days) => {
              const key = `${days}d` as PresetRange;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.rangeButton, dateRange.type === key && styles.rangeButtonActive]}
                  onPress={() => {
                    const end = new Date();
                    const start = new Date(end);
                    start.setDate(start.getDate() - (days - 1));
                    setDateRange({ type: key, start, end });
                  }}
                >
                  <Text style={[styles.rangeButtonText, dateRange.type === key && styles.rangeButtonTextActive]}>
                    {days}d
                  </Text>
                </TouchableOpacity>
              );
            })}

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

        <Text style={styles.rangeSummaryText}>{rangeLabel}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >

        {/* AI Insights Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Insights & Recommendations</Text>

          <Text style={styles.rangeHintText}>
            Insights use the range end date: {selectedDate.toLocaleDateString()}
          </Text>
          
          {aiSummary ? (
            <View style={styles.card}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.cardSubtitle, { color: '#2E7D32' }]}>Insights</Text>
                <Text style={styles.infoText}>{aiSummary.insights}</Text>
              </View>
              <View>
                <Text style={[styles.cardSubtitle, { color: '#1565C0' }]}>Recommendations</Text>
                <Text style={styles.infoText}>{aiSummary.recommendations}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.button, loadingAI && styles.buttonDisabled]} 
              onPress={generateInsights}
              disabled={loadingAI}
            >
              {loadingAI ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Get Insights & Recommendations</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Radar Chart Comparison Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Performance</Text>
          {loadingRadar ? (
            <View style={styles.card}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={[styles.loadingText, { marginTop: 8, textAlign: 'center' }]}>Loading comparison data...</Text>
            </View>
          ) : individualRadarData && averageRadarData ? (
            <ComparisonRadarChart
              individualData={individualRadarData}
              averageData={averageRadarData}
              studentName={displayName || userId}
              selectedCount={selectedCadetsCount}
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.noData}>No comparison data available</Text>
            </View>
          )}
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Activity</Text>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.columnLabel}>Range</Text>
              {loadingRange ? (
                <ActivityIndicator color="#FF6B35" />
              ) : activityAgg.days > 0 ? (
                <>
                  <Text style={styles.statValue}>
                    {Math.round(activityAgg.stepsTotal / activityAgg.days).toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>avg steps/day</Text>
                  <Text style={styles.statSubValue}>
                    {Math.round(activityAgg.caloriesTotal / activityAgg.days)} cal/day
                  </Text>
                  <Text style={styles.statSubValue}>
                    {(activityAgg.distanceTotal / activityAgg.days).toFixed(2)} km/day
                  </Text>
                </>
              ) : (
                <Text style={styles.noData}>No data</Text>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.comparisonColumn}>
              <Text style={styles.columnLabel}>7-Day Avg</Text>
              {stats?.historical.avgActivity ? (
                <>
                  <Text style={styles.statValue}>
                    {stats.historical.avgActivity.steps.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>steps</Text>
                  <Text style={styles.statSubValue}>
                    {stats.historical.avgActivity.calories} cal
                  </Text>
                </>
              ) : (
                <Text style={styles.noData}>No data</Text>
              )}
            </View>
          </View>
        </View>

        {/* Exercise Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Exercise</Text>
          <View style={styles.card}>
            {loadingRange ? (
              <ActivityIndicator color="#FF6B35" />
            ) : exerciseAgg.days > 0 ? (
              <>
                <Text style={styles.cardSubtitle}>
                  {exerciseAgg.workoutTotal} workout(s) in range
                </Text>
                <Text style={styles.infoText}>Avg workouts/day: {(exerciseAgg.workoutTotal / exerciseAgg.days).toFixed(1)}</Text>
                <Text style={styles.infoText}>Total calories: {exerciseAgg.caloriesTotal || 0}</Text>
                <Text style={styles.infoText}>Total distance: {exerciseAgg.distanceTotal || 0}</Text>
              </>
            ) : (
              <Text style={styles.noData}>No data</Text>
            )}
          </View>
        </View>

        {/* Cardio Load Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cardio Load</Text>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.columnLabel}>
                {isSameDay(selectedDate, new Date()) ? 'Today' : 'Selected'}
              </Text>
              {stats?.today.cardioLoad?.data?.cardio_load_ratio ? (
                <>
                  <Text style={styles.statValue}>
                    {stats.today.cardioLoad.data.cardio_load_ratio.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>ratio</Text>
                </>
              ) : (
                <Text style={styles.noData}>No data</Text>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.comparisonColumn}>
              <Text style={styles.columnLabel}>7-Day Avg</Text>
              {stats?.historical.avgCardioLoad ? (
                <>
                  <Text style={styles.statValue}>
                    {stats.historical.avgCardioLoad.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>ratio</Text>
                </>
              ) : (
                <Text style={styles.noData}>No data</Text>
              )}
            </View>
          </View>
        </View>

        {/* Sleep Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleep & Recovery</Text>
          <View style={styles.card}>
            {loadingRange ? (
              <ActivityIndicator color="#FF6B35" />
            ) : sleepAgg.days > 0 ? (
              <>
                <Text style={styles.cardSubtitle}>Range summary</Text>
                <Text style={styles.infoText}>
                  Avg sleep score: {Math.round(sleepAgg.scoreTotal / sleepAgg.days)}
                </Text>
                <Text style={styles.infoText}>
                  Avg duration:{' '}
                  {(() => {
                    const avgMinutes = Math.round(sleepAgg.durationTotal / sleepAgg.days);
                    const h = Math.floor(avgMinutes / 60);
                    const m = avgMinutes % 60;
                    return `${h}h ${m}m`;
                  })()}
                </Text>
              </>
            ) : (
              <Text style={styles.noData}>No data</Text>
            )}
          </View>

          {stats?.today.nightlyRecharge && (
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>Nightly Recharge</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ANS Charge</Text>
                  {stats.today.nightlyRecharge.ans_charge ? (
                    <Text style={styles.statValue}>
                      {stats.today.nightlyRecharge.ans_charge}
                    </Text>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Sleep Charge</Text>
                  {stats.today.nightlyRecharge.sleep_charge ? (
                    <Text style={styles.statValue}>
                      {stats.today.nightlyRecharge.sleep_charge}
                    </Text>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>HRV Avg</Text>
                  {stats.today.nightlyRecharge.heart_rate_variability_avg ? (
                    <Text style={styles.statValue}>
                      {stats.today.nightlyRecharge.heart_rate_variability_avg}
                    </Text>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Breathing Rate</Text>
                  {stats.today.nightlyRecharge.breathing_rate_avg ? (
                    <Text style={styles.statValue}>
                      {stats.today.nightlyRecharge.breathing_rate_avg} /min
                    </Text>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Recent Exercises */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Exercises (Last 7 Days)</Text>
          {stats?.historical.recentExercises && stats.historical.recentExercises.length > 0 ? (
            stats.historical.recentExercises.map((dayExercises: any, idx: number) => (
              <View key={idx} style={styles.card}>
                <Text style={styles.cardSubtitle}>{dayExercises.date}</Text>
                <Text style={styles.exerciseCount}>
                  {dayExercises.count || 0} exercise(s)
                </Text>
                {dayExercises.exercises?.map((ex: any, exIdx: number) => (
                  <View key={exIdx} style={styles.exerciseItem}>
                    <Text style={styles.exerciseSport}>{ex.sport || 'Unknown'}</Text>
                    <Text style={styles.exerciseDetail}>
                      Duration: {formatDuration(ex.duration)}
                    </Text>
                    {ex.calories && (
                      <Text style={styles.exerciseDetail}>
                        Calories: {ex.calories}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.noData}>No recent exercises</Text>
          )}
        </View>

        {/* Heart Rate Section */}
        {stats?.today.continuousHR && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate (Today)</Text>
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>Continuous HR Data Available</Text>
              <Text style={styles.infoText}>
                {stats.today.continuousHR.samples?.length || 0} samples recorded
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Web Date Picker Modal (matches instructor tab UX) */}
      {Platform.OS === 'web' && showDatePicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.webModalOverlay}>
            <View style={styles.webModalContent}>
              <Text style={styles.webModalTitle}>Select Date Range</Text>

              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>Start:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: (dateRange.start instanceof Date ? dateRange.start : new Date()).toISOString().split('T')[0],
                  onChange: (e: any) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) setDateRange((prev) => ({ ...prev, start: d, type: 'custom' }));
                  },
                  style: {
                    padding: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    fontSize: 16,
                  },
                })}
              </View>

              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>End:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: (dateRange.end instanceof Date ? dateRange.end : new Date()).toISOString().split('T')[0],
                  onChange: (e: any) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) setDateRange((prev) => ({ ...prev, end: d, type: 'custom' }));
                  },
                  style: {
                    padding: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    fontSize: 16,
                  },
                })}
              </View>

              <TouchableOpacity style={styles.webApplyButton} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.webApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Native Date Picker */}
      {Platform.OS !== 'web' && showDatePicker && dateRange.type === 'custom' && (
        <DateTimePicker
          value={datePickerMode === 'start' ? dateRange.start : dateRange.end}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 80,
    paddingRight: 16,
  },
  backButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  controlsCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeLabel: {
    color: '#666',
    fontSize: 14,
    marginRight: 10,
  },
  rangeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
  },
  rangeButtonActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3EE',
  },
  rangeButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: '#FF6B35',
  },
  webDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 240,
  },
  webDateLabel: {
    color: '#666',
    fontSize: 14,
    width: 44,
  },
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  webModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
  },
  webApplyButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  webApplyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rangeSummaryText: {
    marginTop: 10,
    color: '#666',
    fontSize: 13,
  },
  rangeHintText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 10,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  comparisonCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  comparisonColumn: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  columnLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'flex-start',
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  statValue: {
    color: '#000000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statSubValue: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  noData: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  exerciseCount: {
    color: '#FF6B35',
    fontSize: 14,
    marginBottom: 8,
  },
  exerciseItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  exerciseSport: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseDetail: {
    color: '#666',
    fontSize: 13,
  },
  infoText: {
    color: '#666',
    fontSize: 14,
  },
  chartContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chartTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabels: {
    height: 150,
    justifyContent: 'space-between',
    paddingRight: 8,
    width: 35,
  },
  yAxisLabel: {
    color: '#666',
    fontSize: 10,
    textAlign: 'right',
  },
  chart: {
    height: 150,
    flex: 1,
    position: 'relative',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartLabel: {
    color: '#666',
    fontSize: 11,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  chartStatLabel: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
  chartStatValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  tooltip: {
    position: 'absolute',
    top: -35,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: '#000000',
    padding: 8,
    borderRadius: 6,
    zIndex: 1000,
    alignSelf: 'center',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#000000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dateButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
    minWidth: 40,
    alignItems: 'center',
  },
  dateButtonDisabled: {
    opacity: 0.3,
  },
  dateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  dateButtonDisabledText: {
    color: '#999999',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});