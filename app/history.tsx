import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

type PresetRange = '7d' | '14d' | '30d';
type DateRange = {
  type: PresetRange | 'custom';
  start: Date;
  end: Date;
};

type DataKind = 'activity' | 'exercise' | 'sleep';

type DailyItem = {
  date: string; // YYYY-MM-DD
  activity?: any;
  exercises?: any;
  sleep?: any;
  // computed summaries
  steps?: number;
  activityCalories?: number;
  activityDistance?: number;
  exerciseCount?: number;
  exerciseCalories?: number;
  exerciseDistance?: number;
  sleepScore?: number;
  sleepStart?: string;
  sleepEnd?: string;
};

function formatPrettyDate(dateStr: string) {
  // dateStr: YYYY-MM-DD
  const formatted = formatDateDdMmYyyy(dateStr);
  return formatted || dateStr;
}

function toIsoDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

function formatLocalIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeSleepDurationLabel(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return undefined;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { type: '7d', start, end };
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  const [showActivity, setShowActivity] = useState(true);
  const [showExercise, setShowExercise] = useState(true);
  const [showSleep, setShowSleep] = useState(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<DailyItem[]>([]);

  const dateBuckets = useMemo(() => {
    const dates: Array<{ key: string; display: string }> = [];

    if (dateRange.type !== 'custom') {
      const days = dateRange.type === '7d' ? 7 : dateRange.type === '14d' ? 14 : 30;
      const today = new Date();
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push({ key: toIsoDateString(d), display: formatLocalIsoDate(d) });
      }
      return dates; // newest -> oldest
    }

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Ensure start <= end
    const startMs = Math.min(start.getTime(), end.getTime());
    const endMs = Math.max(start.getTime(), end.getTime());
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const maxDays = 90;
    const msPerDay = 24 * 60 * 60 * 1000;
    const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    const boundedCount = Math.min(dayCount, maxDays);

    for (let i = 0; i < boundedCount; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      dates.push({ key: toIsoDateString(d), display: formatLocalIsoDate(d) });
    }

    return dates; // newest -> oldest
  }, [dateRange]);

  const onDateChange = (_event: any, selected?: Date) => {
    // Android fires a dismiss event; selected will be undefined
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (!selected || isNaN(selected.getTime())) return;

    setDateRange((prev) => ({
      ...prev,
      type: 'custom',
      [datePickerMode]: selected,
    }));
  };

  const selectedKinds: DataKind[] = useMemo(() => {
    const kinds: DataKind[] = [];
    if (showActivity) kinds.push('activity');
    if (showExercise) kinds.push('exercise');
    if (showSleep) kinds.push('sleep');
    return kinds;
  }, [showActivity, showExercise, showSleep]);

  const load = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;

    try {
      const results = await Promise.all(
        dateBuckets.map(async ({ key, display }) => {
          const [activitySnap, exercisesSnap, sleepSnap] = await Promise.all([
            getDoc(doc(db, `users/${uid}/polarData/activities/all/${key}`)),
            getDoc(doc(db, `users/${uid}/polarData/exercises/all/${key}`)),
            getDoc(doc(db, `users/${uid}/polarData/sleep/all/${key}`)),
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
            typeof activity?.distance === 'number' ? activity.distance : undefined;

          let exerciseCount: number | undefined = undefined;
          let exerciseCalories: number | undefined = undefined;
          let exerciseDistance: number | undefined = undefined;
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

          return {
            date: display,
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
          } satisfies DailyItem;
        })
      );

      setItems(results);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateBuckets, user?.uid]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (!user) {
    return null;
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading history…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>History</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.controlsCard}>
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Range:</Text>
          <View style={styles.rangeButtons}>
            {([
              { key: '7d', label: '7d' },
              { key: '14d', label: '14d' },
              { key: '30d', label: '30d' },
            ] as const).map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.rangeButton, dateRange.type === r.key && styles.rangeButtonActive]}
                onPress={() => setDateRange((prev) => ({ ...prev, type: r.key }))}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    dateRange.type === r.key && styles.rangeButtonTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.rangeButton, dateRange.type === 'custom' && styles.rangeButtonActive]}
              onPress={() => {
                setDateRange((prev) => ({ ...prev, type: 'custom' }));
                setShowDatePicker(true);
              }}
            >
              <Text
                style={[
                  styles.rangeButtonText,
                  dateRange.type === 'custom' && styles.rangeButtonTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {dateRange.type === 'custom' && (
          <View style={styles.customRow}>
            {Platform.OS === 'web' ? (
              <>
                <View style={styles.webDateRow}>
                  <Text style={styles.webDateLabel}>Start:</Text>
                  {React.createElement('input', {
                    type: 'date',
                    value: formatLocalIsoDate(dateRange.start),
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
                    value: formatLocalIsoDate(dateRange.end),
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
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => {
                    setDatePickerMode('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.customDateButtonLabel}>Start</Text>
                  <Text style={styles.customDateButtonValue}>{formatDateDdMmYyyy(dateRange.start)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => {
                    setDatePickerMode('end');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.customDateButtonLabel}>End</Text>
                  <Text style={styles.customDateButtonValue}>{formatDateDdMmYyyy(dateRange.end)}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Show:</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterChip, showActivity && styles.filterChipActive]}
              onPress={() => setShowActivity((v) => !v)}
            >
              <Text style={[styles.filterChipText, showActivity && styles.filterChipTextActive]}>
                Activity
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, showExercise && styles.filterChipActive]}
              onPress={() => setShowExercise((v) => !v)}
            >
              <Text style={[styles.filterChipText, showExercise && styles.filterChipTextActive]}>
                Exercise
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, showSleep && styles.filterChipActive]}
              onPress={() => setShowSleep((v) => !v)}
            >
              <Text style={[styles.filterChipText, showSleep && styles.filterChipTextActive]}>
                Sleep
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {selectedKinds.length === 0 && (
          <Text style={styles.filterHint}>Select at least one type to display.</Text>
        )}
      </View>

      <FlatList
        data={selectedKinds.length === 0 ? [] : items}
        keyExtractor={(it) => it.date}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => {
          const sleepDuration = computeSleepDurationLabel(item.sleepStart, item.sleepEnd);

          const oneKind = selectedKinds.length === 1 ? selectedKinds[0] : null;

          return (
            <View style={styles.dayCard}>
              <Text style={styles.dayTitle}>{formatPrettyDate(item.date)}</Text>

              {/* If a single type is selected, show it as a full-width card */}
              {oneKind === 'activity' && (
                <View style={styles.sectionCardFull}>
                  <Text style={styles.sectionTitle}>Activity</Text>
                  <Text style={styles.sectionValue}>Steps: {item.steps ?? '—'}</Text>
                  <Text style={styles.sectionValue}>Calories: {item.activityCalories ?? '—'}</Text>
                  <Text style={styles.sectionValue}>
                    Distance: {typeof item.activityDistance === 'number' ? item.activityDistance : '—'}
                  </Text>
                </View>
              )}

              {oneKind === 'exercise' && (
                <View style={styles.sectionCardFull}>
                  <Text style={styles.sectionTitle}>Exercise</Text>
                  <Text style={styles.sectionValue}>Workouts: {item.exerciseCount ?? '—'}</Text>
                  <Text style={styles.sectionValue}>Calories: {item.exerciseCalories ?? '—'}</Text>
                  <Text style={styles.sectionValue}>Distance: {item.exerciseDistance ?? '—'}</Text>
                </View>
              )}

              {oneKind === 'sleep' && (
                <View style={styles.sectionCardFull}>
                  <Text style={styles.sectionTitle}>Sleep</Text>
                  <Text style={styles.sectionValue}>Score: {item.sleepScore ?? '—'}</Text>
                  <Text style={styles.sectionValue}>Duration: {sleepDuration ?? '—'}</Text>
                </View>
              )}

              {/* Multi-select layout */}
              {oneKind === null && (
                <>
                  {(showActivity || showExercise) && (
                    <View style={styles.sectionRow}>
                      {showActivity && (
                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionTitle}>Activity</Text>
                          <Text style={styles.sectionValue}>Steps: {item.steps ?? '—'}</Text>
                          <Text style={styles.sectionValue}>Calories: {item.activityCalories ?? '—'}</Text>
                          <Text style={styles.sectionValue}>
                            Distance: {typeof item.activityDistance === 'number' ? item.activityDistance : '—'}
                          </Text>
                        </View>
                      )}

                      {showExercise && (
                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionTitle}>Exercise</Text>
                          <Text style={styles.sectionValue}>Workouts: {item.exerciseCount ?? '—'}</Text>
                          <Text style={styles.sectionValue}>Calories: {item.exerciseCalories ?? '—'}</Text>
                          <Text style={styles.sectionValue}>Distance: {item.exerciseDistance ?? '—'}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {showSleep && (
                    <View style={styles.sectionCardFull}>
                      <Text style={styles.sectionTitle}>Sleep</Text>
                      <Text style={styles.sectionValue}>Score: {item.sleepScore ?? '—'}</Text>
                      <Text style={styles.sectionValue}>Duration: {sleepDuration ?? '—'}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No data found for this range.</Text>
          </View>
        }
      />

      {/* Web custom date picker modal: mirrors instructor dashboard approach */}
      {Platform.OS === 'web' && showDatePicker && dateRange.type === 'custom' && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.webModalOverlay}>
            <View style={styles.webModalContent}>
              <Text style={styles.webModalTitle}>Custom Range</Text>

              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>Start:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: formatLocalIsoDate(dateRange.start),
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
                  value: formatLocalIsoDate(dateRange.end),
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

const Colors = {
  primary: '#FF6B35',
  background: '#F8F9FA',
  card: '#FFFFFF',
  text: '#2D3436',
  textSecondary: '#636E72',
  border: '#E5E7EB',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  controlsCard: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 10,
  },
  backText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  rangeButtons: {
    flexDirection: 'row',
    marginLeft: 12,
    flexWrap: 'wrap',
  },
  rangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  rangeButtonActive: {
    backgroundColor: Colors.text,
  },
  rangeButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
  },
  customRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  customDateButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  customDateButtonLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  customDateButtonValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  filterRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: Colors.text,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterHint: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  webModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  webDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  webDateLabel: {
    color: Colors.textSecondary,
    fontWeight: '700',
    marginRight: 10,
  },
  webApplyButton: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  webApplyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
  },
  dayCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  sectionCardFull: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
  },
});
