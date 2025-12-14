import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '@/components/Themed';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatIsoDurationHms as formatDuration } from '@/src/utils/formatDuration';

const Colors = {
  primary: '#FF6B35',
  background: '#F8F9FA',
  card: '#FFFFFF',
  text: '#2D3436',
  textSecondary: '#636E72',
  border: '#E0E0E0',
};

type PresetRange = '7d' | '14d' | '30d';
type DateRange = {
  type: PresetRange | 'custom';
  start: Date;
  end: Date;
};

type PolarExercise = {
  sport?: string;
  duration?: string; // ISO8601
  calories?: number;
  distance?: number;
  start_time?: string;
  start_time_local?: string;
  [key: string]: any;
};

type ExerciseRow = {
  date: string; // YYYY-MM-DD
  exercise: PolarExercise;
};

function toIsoDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function MeExercisesScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { type: '7d', start, end };
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('All');

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

  const loadExercises = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const perDay = await Promise.all(
        dateStrings.map(async (ds) => {
          const snap = await getDoc(doc(db, `users/${user.uid}/polarData/exercises/all/${ds}`));
          if (!snap.exists()) return [] as ExerciseRow[];
          const data: any = snap.data();

          const list: any[] = Array.isArray(data?.exercises)
            ? data.exercises
            : Array.isArray(data?.data?.exercises)
              ? data.data.exercises
              : [];

          return list.map((exercise) => ({ date: ds, exercise })) as ExerciseRow[];
        })
      );

      const flattened = perDay.flat();
      setRows(flattened);

      // Reset sport filter if it no longer exists in this range.
      setSelectedSport((prev) => {
        if (prev === 'All') return prev;
        const stillExists = flattened.some((r) => (r.exercise?.sport || 'Unknown') === prev);
        return stillExists ? prev : 'All';
      });
    } finally {
      setLoading(false);
    }
  }, [dateStrings, user?.uid]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadExercises();
    } finally {
      setRefreshing(false);
    }
  }, [loadExercises]);

  const availableSports = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.exercise?.sport || 'Unknown'));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedSport === 'All') return rows;
    return rows.filter((r) => (r.exercise?.sport || 'Unknown') === selectedSport);
  }, [rows, selectedSport]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, PolarExercise[]>();
    filteredRows.forEach((r) => {
      const arr = map.get(r.date) || [];
      arr.push(r.exercise);
      map.set(r.date, arr);
    });

    // Keep date order consistent with dateStrings (already newest-first)
    return dateStrings
      .filter((d) => map.has(d))
      .map((d) => ({ date: d, exercises: map.get(d)! }));
  }, [filteredRows, dateStrings]);

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

  const totalExercises = filteredRows.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Exercises</Text>
        <View style={{ width: 64 }} />
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

        <Text style={styles.filterLabel}>Sport:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportChipsRow}>
          {availableSports.map((sport) => {
            const active = selectedSport === sport;
            return (
              <TouchableOpacity
                key={sport}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedSport(sport)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{sport}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.summaryText}>{totalExercises.toLocaleString()} exercise(s) in range</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading exercises…</Text>
          </View>
        ) : groupedByDate.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No exercises found for this range.</Text>
          </View>
        ) : (
          groupedByDate.map(({ date, exercises }) => (
            <View key={date} style={styles.section}>
              <Text style={styles.sectionTitle}>{date}</Text>
              {exercises.map((ex, idx) => (
                <TouchableOpacity
                  key={`${date}-${idx}`}
                  style={styles.card}
                  activeOpacity={0.85}
                  disabled={!((ex as any)?.id)}
                  onPress={() => {
                    const id = (ex as any)?.id;
                    if (!id) return;
                    router.push({
                      pathname: '/exercise/[date]/[exerciseId]',
                      params: { date, exerciseId: String(id) },
                    });
                  }}
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.sportText}>{ex.sport || 'Unknown'}</Text>
                    <Text style={styles.durationText}>{formatDuration(ex.duration)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Calories</Text>
                    <Text style={styles.detailValue}>{typeof ex.calories === 'number' ? ex.calories : '—'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Distance</Text>
                    <Text style={styles.detailValue}>{typeof ex.distance === 'number' ? ex.distance : '—'}</Text>
                  </View>
                  {(ex.start_time_local || ex.start_time) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Start</Text>
                      <Text style={styles.detailValue}>
                        {(() => {
                          const raw = ex.start_time_local || ex.start_time;
                          const d = raw ? new Date(raw) : null;
                          return d && !isNaN(d.getTime()) ? d.toLocaleString() : String(raw);
                        })()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 64,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  controlsCard: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeLabel: {
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
    backgroundColor: '#F9F9F9',
  },
  rangeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  rangeButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
  },
  rangeSummaryText: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  filterLabel: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  sportChipsRow: {
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F9F9F9',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  summaryText: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sportText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailKey: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
    flexShrink: 1,
    textAlign: 'right',
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
  webDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 240,
    marginBottom: 12,
  },
  webDateLabel: {
    color: '#666',
    fontSize: 14,
    width: 44,
  },
  webApplyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  webApplyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
