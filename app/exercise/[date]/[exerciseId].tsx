import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/Themed';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatIsoDurationHms as formatDuration } from '@/src/utils/formatDuration';

function formatDistance(maybeMeters: any): string {
  const meters = typeof maybeMeters === 'number' ? maybeMeters : Number(maybeMeters);
  if (!isFinite(meters)) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatNumber(v: any): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString();
}

function safeDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export default function ExerciseDetailScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const dateParam = String(params.date ?? '');
  const exerciseIdParam = String(params.exerciseId ?? '');
  const userIdParam = params.userId ? String(params.userId) : undefined;

  const targetUserId = userIdParam || user?.uid;

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!targetUserId) {
        setLoading(false);
        setError('Missing user');
        return;
      }
      if (!dateParam || !exerciseIdParam) {
        setLoading(false);
        setError('Missing exercise params');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, `users/${targetUserId}/polarData/exercises/all/${dateParam}`));
        if (!snap.exists()) {
          if (!cancelled) setExercise(null);
          return;
        }

        const data: any = snap.data();
        const list: any[] = Array.isArray(data?.exercises)
          ? data.exercises
          : Array.isArray(data?.data?.exercises)
            ? data.data.exercises
            : [];

        const found = list.find((e) => String(e?.id ?? '') === exerciseIdParam) || null;
        if (!cancelled) setExercise(found);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load exercise');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [dateParam, exerciseIdParam, targetUserId]);

  const headerTitle = useMemo(() => {
    const sport = exercise?.sport || 'Exercise';
    return sport;
  }, [exercise]);

  const hrAvg = exercise?.heart_rate?.average ?? exercise?.heart_rate_avg ?? exercise?.heartRateAvg;
  const hrMax = exercise?.heart_rate?.maximum ?? exercise?.heart_rate_max ?? exercise?.heartRateMax;

  const zones = useMemo(() => {
    const z =
      exercise?.heart_rate_zones ||
      exercise?.heart_rate?.zones ||
      exercise?.zones ||
      exercise?.heartRateZones;

    if (Array.isArray(z)) return z;
    if (Array.isArray(z?.zones)) return z.zones;
    return [] as any[];
  }, [exercise]);

  const laps = useMemo(() => {
    const l = exercise?.laps;
    return Array.isArray(l) ? l : [];
  }, [exercise]);

  const routeSampleCount = useMemo(() => {
    const gps = exercise?.samples?.gps;
    if (Array.isArray(gps)) return gps.length;
    const route = exercise?.route;
    if (Array.isArray(route)) return route.length;
    return null;
  }, [exercise]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#FF6B35" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 64 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !exercise ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Exercise not found.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{dateParam}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Start</Text>
              <Text style={styles.value}>{safeDateTime(exercise?.start_time_local || exercise?.start_time)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{formatDuration(exercise?.duration)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Calories</Text>
              <Text style={styles.value}>{formatNumber(exercise?.calories)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>{formatDistance(exercise?.distance)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Heart Rate</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Avg</Text>
              <Text style={styles.value}>{formatNumber(hrAvg)} bpm</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Max</Text>
              <Text style={styles.value}>{formatNumber(hrMax)} bpm</Text>
            </View>

            {zones.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.subTitle}>Zones</Text>
                {zones.map((z: any, idx: number) => {
                  const lower = z?.lower_limit ?? z?.lowerLimit;
                  const upper = z?.upper_limit ?? z?.upperLimit;
                  const inZone = z?.in_zone ?? z?.inZone ?? z?.time_in_zone ?? z?.timeInZone;
                  return (
                    <View key={idx} style={styles.row}>
                      <Text style={styles.label}>{`Zone ${idx + 1}`}</Text>
                      <Text style={styles.value}>
                        {lower != null && upper != null ? `${lower}-${upper} bpm` : '—'}
                        {inZone != null ? ` • ${formatDuration(inZone)}` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {laps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Laps</Text>
              {laps.map((lap: any, idx: number) => {
                const lapDistance = lap?.distance;
                const lapDuration = lap?.duration;
                return (
                  <View key={idx} style={styles.row}>
                    <Text style={styles.label}>{`Lap ${idx + 1}`}</Text>
                    <Text style={styles.value}>
                      {lapDuration ? formatDuration(lapDuration) : '—'}
                      {lapDistance != null ? ` • ${formatDistance(lapDistance)}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {routeSampleCount != null && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Route</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Samples</Text>
                <Text style={styles.value}>{routeSampleCount.toLocaleString()}</Text>
              </View>
            </View>
          )}

          {(exercise?.notes || exercise?.note || exercise?.description) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              <Text style={styles.paragraph}>{String(exercise?.notes || exercise?.note || exercise?.description)}</Text>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 64,
  },
  backText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  muted: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#b00020',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  label: {
    color: '#666',
    fontSize: 13,
    paddingRight: 10,
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  paragraph: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
});
