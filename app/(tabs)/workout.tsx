  import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams } from 'expo-router';
import { useMultiDeviceWorkout } from '@/src/hooks/useMultiDeviceWorkout';
import { useEmulatedHeartRate } from '@/src/hooks/useEmulatedHeartRate';
import { BaselineRange, usePolarHistoricalBaseline } from '@/src/hooks/usePolarHistoricalBaseline';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BluetoothDevice, ConnectedDeviceInfo } from '@/src/services/bluetoothTypes';
import { liveStyles as styles } from '@/src/styles';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/services/firebase';
import {
  addEmulationDevice,
  clearEmulationDevices,
  getEmulationDevices,
  removeEmulationDevice,
} from '@/src/services/emulationStorage';

import { HrPoint } from '@/components/workout/HrComparisonChart';

// Components
import { MultiDeviceScanner } from '@/components/multi-device/MultiDeviceScanner';
import { ConnectedDevicesList } from '@/components/multi-device/ConnectedDevicesList';
import { MultiDeviceControls } from '@/components/multi-device/MultiDeviceControls';
import { GroupMetrics } from '@/components/multi-device/GroupMetrics';

type AgeCacheEntry = { fetchedAtMs: number; age: number | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBAL_AGE_CACHE: Record<string, AgeCacheEntry> = ((globalThis as any).__QUESTFIT_AGE_CACHE__ ??= {});

export default function WorkoutScreen() {
  const searchParams = useLocalSearchParams();
  const emulate = String(searchParams.emulate ?? '').toLowerCase() === 'true';

  const colorScheme = useColorScheme();
  const {
    isScanning,
    availableDevices,
    connectedDevices,
    deviceHeartRates,
    workoutActive,
    workoutPaused,
    pauseReason,
    countdown,
    workoutMetrics,
    error,
    bluetoothEnabled,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    disconnectAll,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    endWorkout,
    checkBluetoothStatus,
  } = useMultiDeviceWorkout();

  const [simWorkoutActive, setSimWorkoutActive] = useState(false);
  const [simStartedAtMs, setSimStartedAtMs] = useState<number | null>(null);

  const [emulationDevices, setEmulationDevices] = useState<Array<{ deviceId: string; userId: string; label?: string }>>(
    []
  );

  const [emuUserId, setEmuUserId] = useState('');
  const [emuResolveLoading, setEmuResolveLoading] = useState(false);
  const [emuResolvedDisplayName, setEmuResolvedDisplayName] = useState('');
  const [emuResolvedDeviceId, setEmuResolvedDeviceId] = useState('');

  const [emuHrOverrides, setEmuHrOverrides] = useState<Record<string, number | null>>({});

  const [baselineRange, setBaselineRange] = useState<BaselineRange>('7d');

  // Per-device HR history for charting (emulation mode).
  const [emuHrHistory, setEmuHrHistory] = useState<Record<string, HrPoint[]>>({});

  const useUserAge = (userId: string | null | undefined) => {
    const [age, setAge] = useState<number | null>(null);

    useEffect(() => {
      let cancelled = false;
      const uid = (userId ?? '').trim();
      if (!uid) {
        setAge(null);
        return;
      }

      const cached = GLOBAL_AGE_CACHE[uid];
      if (cached) setAge(cached.age);

      (async () => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          const data = snap.exists() ? (snap.data() as any) : undefined;

          const raw = data?.age;
          const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
          const resolved = Number.isFinite(n) ? Math.max(0, Math.min(120, Math.round(n))) : null;
          GLOBAL_AGE_CACHE[uid] = { fetchedAtMs: Date.now(), age: resolved };
          if (!cancelled) setAge(resolved);
        } catch {
          GLOBAL_AGE_CACHE[uid] = { fetchedAtMs: Date.now(), age: null };
          if (!cancelled) setAge(null);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [userId]);

    return age;
  };

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  // TRIMP-like load from HR only. Returns cumulative load units.
  const estimateTrimpLoad = (avgHr: number, seconds: number, hrMax: number) => {
    const durationMin = seconds / 60;
    if (!Number.isFinite(durationMin) || durationMin <= 0) return 0;
    const intensity = clamp(avgHr / hrMax, 0, 1);
    // Nonlinear weighting so higher intensity climbs faster.
    const weight = intensity < 0.6 ? 0.5 : intensity < 0.75 ? 1.0 : intensity < 0.85 ? 1.5 : 2.2;
    return durationMin * intensity * weight;
  };

  useEffect(() => {
    if (!emulate) return;
    getEmulationDevices()
      .then((d) => {
        setEmulationDevices(d);
      })
      .catch((e) => console.error('Failed to load emulation devices:', e));
  }, [emulate]);

  const refreshEmulationDevices = async () => {
    const devices = await getEmulationDevices();
    setEmulationDevices(devices);
  };

  const resolveUserForEmulation = async (userId: string) => {
    const normalized = userId.trim();
    if (!normalized) {
      setEmuResolvedDisplayName('');
      setEmuResolvedDeviceId('');
      return;
    }

    setEmuResolveLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', normalized));
      const data = userDoc.exists() ? (userDoc.data() as any) : undefined;
      const name = data?.displayName;
      const did = data?.deviceID ?? data?.deviceId;
      setEmuResolvedDisplayName(typeof name === 'string' ? name : '');
      setEmuResolvedDeviceId(typeof did === 'string' ? did : '');
    } catch (e) {
      console.error('Failed to resolve emulation user:', e);
      setEmuResolvedDisplayName('');
      setEmuResolvedDeviceId('');
    } finally {
      setEmuResolveLoading(false);
    }
  };

  const emuDeviceInputs = useMemo(() => {
    if (!emulate) return undefined;
    if (emulationDevices.length === 0) return undefined;
    // IMPORTANT: use a stable, user-scoped ID so multiple users with the same deviceId
    // don't collide in the emulated HR map.
    return emulationDevices.map((d) => ({ id: `${d.userId}__${d.deviceId}`, name: d.label ?? d.deviceId }));
  }, [emulate, emulationDevices]);

  // Ensure we have an HR override entry for every device (default 120 bpm).
  useEffect(() => {
    if (!emulate) return;
    setEmuHrOverrides((prev) => {
      const next: Record<string, number | null> = { ...prev };
      for (const d of emulationDevices) {
        const key = `${d.userId}__${d.deviceId}`;
        if (next[key] === undefined) next[key] = 120;
      }
      for (const k of Object.keys(next)) {
        if (!emulationDevices.some((d) => `${d.userId}__${d.deviceId}` === k)) delete next[k];
      }
      return next;
    });
  }, [emulate, emulationDevices]);

  const emu = useEmulatedHeartRate({
    enabled: emulate && simWorkoutActive,
    devices: emuDeviceInputs,
    overrides: emuHrOverrides,
  });

  const [simWorkoutSeconds, setSimWorkoutSeconds] = useState(0);

  const effectiveDeviceHeartRates = emulate ? emu.deviceHeartRates : deviceHeartRates;

  const emuKeyFor = useCallback((userId: string, deviceId: string) => `${userId}__${deviceId}`, []);

  // Record HR history while simulated workout is active.
  // We append one point per second per device (and avoid duplicates).
  useEffect(() => {
    if (!emulate || !simWorkoutActive) return;
    const tSec = simWorkoutSeconds;
    if (!Number.isFinite(tSec) || tSec < 0) return;

    setEmuHrHistory((prev) => {
      let next: Record<string, HrPoint[]> | null = null;

      for (const d of emulationDevices) {
        const key = emuKeyFor(d.userId, d.deviceId);
        const hr = effectiveDeviceHeartRates.get(key);
        if (hr == null || hr <= 0) continue;

        const existing = prev[key] ?? [];
        const last = existing.length > 0 ? existing[existing.length - 1] : null;

        // Avoid duplicate writes for the same second.
        if (last && last.tSec === tSec) {
          if (last.hr === hr) continue;
          // Same second but HR changed: replace last point.
          const replaced = [...existing.slice(0, -1), { tSec, hr }];
          const trimmed = replaced.filter((p) => tSec - p.tSec <= 1200);
          if (!next) next = { ...prev };
          next[key] = trimmed;
          continue;
        }

        const updated = [...existing, { tSec, hr }];
        // Keep last ~20 minutes (1200 seconds) to cap memory.
        const trimmed = updated.length > 0 ? updated.filter((p) => tSec - p.tSec <= 1200) : updated;

        if (!next) next = { ...prev };
        next[key] = trimmed;
      }

      return next ?? prev;
    });
  }, [emulate, simWorkoutActive, simWorkoutSeconds, emulationDevices, effectiveDeviceHeartRates]);

  // Reset history when stopping simulation.
  useEffect(() => {
    if (!emulate) return;
    if (simWorkoutActive) return;
    setEmuHrHistory({});
  }, [emulate, simWorkoutActive]);

  const effectiveConnectedDevices: ConnectedDeviceInfo[] = useMemo(() => {
    if (!emulate) return connectedDevices;
    return emu.devices.map((d) => ({
      device: { id: d.id, name: d.name },
      currentHeartRate: effectiveDeviceHeartRates.get(d.id) ?? null,
      lastHeartRateTime: null,
      heartRateReadings: [],
    }));
  }, [emulate, connectedDevices, emu.devices, effectiveDeviceHeartRates]);

  const [deviceOwners, setDeviceOwners] = useState<Record<string, string>>({});

  useEffect(() => {
    checkBluetoothStatus();
  }, [checkBluetoothStatus]);

  useEffect(() => {
    const fetchDeviceOwners = async () => {
      if (availableDevices.length === 0) return;

      try {
        const deviceIds = availableDevices.map((d) => d.id);
        const nameToIdMap: Record<string, string> = {};

        availableDevices.forEach((d) => {
          if (!d.name) return;
          const parts = d.name.split(' ');
          const lastPart = parts[parts.length - 1];
          if (/^[0-9A-F]{8}$/i.test(lastPart)) {
            nameToIdMap[lastPart] = d.id;
            if (!deviceIds.includes(lastPart)) deviceIds.push(lastPart);
          }
        });

        const chunks: string[][] = [];
        for (let i = 0; i < deviceIds.length; i += 10) {
          chunks.push(deviceIds.slice(i, i + 10));
        }

        const newOwners: Record<string, string> = {};

        for (const chunk of chunks) {
          const q1 = query(collection(db, 'users'), where('deviceID', 'in', chunk));
          const snap1 = await getDocs(q1);
          const q2 = query(collection(db, 'users'), where('deviceId', 'in', chunk));
          const snap2 = await getDocs(q2);

          const processDoc = (docSnap: any) => {
            const data = docSnap.data();
            const id = data.deviceID || data.deviceId;
            if (!id || !data.displayName) return;

            if (availableDevices.some((d) => d.id === id)) {
              newOwners[id] = data.displayName;
            }
            if (nameToIdMap[id]) {
              newOwners[nameToIdMap[id]] = data.displayName;
            }
          };

          snap1.forEach(processDoc);
          snap2.forEach(processDoc);
        }

        setDeviceOwners((prev) => ({ ...prev, ...newOwners }));
      } catch (err) {
        console.error('Error fetching device owners:', err);
      }
    };

    void fetchDeviceOwners();
  }, [availableDevices, checkBluetoothStatus]);

  const handleScan = async () => {
    if (!bluetoothEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices.');
      return;
    }
    await scanForDevices();
  };

  const handleConnect = async (device: BluetoothDevice) => {
    try {
      await connectToDevice(device);
      Alert.alert('Connected', `Connected to ${device.name || device.id}`);
    } catch {
      Alert.alert('Connection Failed', 'Could not connect to device. Please try again.');
    }
  };

  const handleDisconnectDevice = async (deviceId: string, deviceName?: string) => {
    Alert.alert('Disconnect', `Disconnect from ${deviceName || 'this device'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectDevice(deviceId);
        },
      },
    ]);
  };

  const handleDisconnectAll = async () => {
    Alert.alert('Disconnect All', 'Are you sure you want to disconnect all devices?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect All',
        style: 'destructive',
        onPress: async () => {
          await disconnectAll();
          Alert.alert('Disconnected', 'All devices disconnected successfully');
        },
      },
    ]);
  };

  const handleStartWorkout = () => {
    if (emulate) {
      if (emulationDevices.length === 0) {
        Alert.alert('No emulation devices', 'Add at least one user below first.');
        return;
      }
      setSimStartedAtMs(Date.now());
      setSimWorkoutActive(true);
      return;
    }

    startWorkout();
  };

  const handleEndWorkout = () => {
    if (emulate) {
      setSimWorkoutActive(false);
      setSimStartedAtMs(null);
      Alert.alert('Simulated workout ended');
      return;
    }

    Alert.alert('End Workout', 'Are you sure you want to end this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Workout',
        style: 'destructive',
        onPress: () => {
          const metrics = endWorkout();
          if (metrics) {
            Alert.alert(
              'Workout Complete!',
              `Duration: ${Math.floor(metrics.duration / 60)}m ${metrics.duration % 60}s\n` +
                `Avg HR: ${metrics.averageHeartRate} bpm\n` +
                `Max HR: ${metrics.maxHeartRate} bpm\n` +
                `Calories: ${metrics.caloriesBurned} kcal`
            );
          }
        },
      },
    ]);
  };

  const aggregateHeartRate =
    effectiveConnectedDevices.length > 0
      ? (() => {
          const validHRs = Array.from(effectiveDeviceHeartRates.values()).filter(
            (hr): hr is number => hr !== null && hr > 0
          );
          if (validHRs.length === 0) return null;
          return Math.round(validHRs.reduce((sum, hr) => sum + hr, 0) / validHRs.length);
        })()
      : null;

  const formatElapsed = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!emulate || !simWorkoutActive || !simStartedAtMs) {
      setSimWorkoutSeconds(0);
      return;
    }

    const update = () => {
      setSimWorkoutSeconds(Math.max(0, Math.floor((Date.now() - simStartedAtMs) / 1000)));
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [emulate, simWorkoutActive, simStartedAtMs]);

  const estimateCaloriesFromHr = (avgHr: number, seconds: number) => {
    // Keep consistent with the native rough estimate.
    return Math.round((avgHr * seconds * 0.1) / 60);
  };

  const EmulationComparisonInner = ({
    userId,
    deviceId,
    emuKey,
    range,
    currentHr,
    simWorkoutActive: isActive,
    simSeconds,
  }: {
    userId: string;
    deviceId: string;
    emuKey: string;
    range: BaselineRange;
    currentHr: number | null;
    simWorkoutActive: boolean;
    simSeconds: number;
  }) => {
    const { baseline, loading, refreshing, error: baselineError } = usePolarHistoricalBaseline(userId, range);
      const age = useUserAge(userId);
      const hrMax = useMemo(() => {
        const a = age;
        if (a == null) return 190;
        return clamp(220 - a, 120, 220);
      }, [age]);

      const simCalories = useMemo(() => {
        if (!isActive || currentHr == null) return null;
        return estimateCaloriesFromHr(currentHr, simSeconds);
      }, [currentHr, isActive, simSeconds]);

      const simCardioLoad = useMemo(() => {
        if (!isActive || currentHr == null) return null;
        const trimp = estimateTrimpLoad(currentHr, simSeconds, hrMax);
        return Math.round(trimp * 0.08 * 1000) / 1000;
      }, [currentHr, hrMax, isActive, simSeconds]);

      const hrDelta = useMemo(() => {
        if (!baseline || baseline.avgExerciseHr == null || currentHr == null) return null;
        return currentHr - baseline.avgExerciseHr;
      }, [baseline, currentHr]);

      const caloriesDelta = useMemo(() => {
        if (!baseline || baseline.avgExerciseCalories == null || simCalories == null) return null;
        return simCalories - baseline.avgExerciseCalories;
      }, [baseline, simCalories]);

      const cardioDelta = useMemo(() => {
        if (!baseline || baseline.avgCardioLoadRatio == null || simCardioLoad == null) return null;
        return Math.round((simCardioLoad - baseline.avgCardioLoadRatio) * 1000) / 1000;
      }, [baseline, simCardioLoad]);

    return (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: '#99999933',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Historical comparison</Text>
          <Text style={{ opacity: 0.85, marginBottom: 10 }}>
            Baseline: {range === '7d' ? 'last 7 days' : 'last 30 days'}
          </Text>

          {/*
          <View
            style={{
              marginBottom: 10,
              borderRadius: 10,
              padding: 10,
              backgroundColor: '#00000022',
              borderWidth: 1,
              borderColor: '#ffffff22',
            }}
          >
            <Text style={{ opacity: 0.85, marginBottom: 6 }}>Heart rate vs baseline</Text>
            <HrComparisonChart
              points={emuHrHistory[emuKey] ?? []}
              baselineHr={baseline?.avgExerciseHr ?? null}
              tick={simSeconds}
              height={140}
            />
          </View>
          */}

          <Text style={{ opacity: 0.75, marginBottom: 10 }}>
            HR max estimate: {hrMax} (age {age ?? '--'})
          </Text>

          {!isActive && <Text style={{ opacity: 0.85 }}>Press Start Simulated Connection to begin.</Text>}

          {loading && !baseline && <Text style={{ opacity: 0.85 }}>Loading baseline...</Text>}
          {baselineError && <Text style={{ opacity: 0.85 }}>Baseline error: {baselineError}</Text>}

          {refreshing && baseline && (
            <Text style={{ opacity: 0.6, marginTop: 6 }}>Updating baseline…</Text>
          )}

          {baseline && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text>HR now vs avg</Text>
                <Text>
                  {currentHr ?? '--'} / {baseline.avgExerciseHr ?? '--'}
                  {hrDelta != null ? ` (${hrDelta >= 0 ? '+' : ''}${hrDelta})` : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text>Calories now vs avg</Text>
                <Text>
                  {simCalories ?? '--'} / {baseline.avgExerciseCalories ?? '--'}
                  {caloriesDelta != null ? ` (${caloriesDelta >= 0 ? '+' : ''}${caloriesDelta})` : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text>Cardio load now vs avg</Text>
                <Text>
                  {simCardioLoad ?? '--'} / {baseline.avgCardioLoadRatio ?? '--'}
                  {cardioDelta != null ? ` (${cardioDelta >= 0 ? '+' : ''}${cardioDelta})` : ''}
                </Text>
              </View>

              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#99999922', paddingTop: 8 }}>
                <Text style={{ fontWeight: '700', marginBottom: 4 }}>Best workout in range</Text>
                {baseline.bestWorkout ? (
                  <Text style={{ opacity: 0.9 }}>
                    {baseline.bestWorkout.date}: HR {baseline.bestWorkout.avgHr ?? '--'}, calories {baseline.bestWorkout.calories ?? '--'}, cardio load {baseline.bestWorkout.cardioLoad ?? '--'}
                  </Text>
                ) : (
                  <Text style={{ opacity: 0.85 }}>No workouts found in range.</Text>
                )}
              </View>
            </>
          )}
        </View>
    );
  };

  const EmulationComparison = useMemo(() => memo(EmulationComparisonInner), []);

  return (
    <SafeAreaView
      style={[styles.container, { flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout</Text>
          <Text style={styles.subtitle}>Connect multiple Polar watches for team tracking</Text>
          {emulate && (
            <Text style={styles.subtitle}>Emulation mode: using simulated heart rate</Text>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Warning: {error}</Text>
          </View>
        )}

        {emulate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Simulated Devices</Text>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Pressable
                onPress={() => setBaselineRange('7d')}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: baselineRange === '7d' ? Colors[colorScheme ?? 'light'].tint : '#ffffff22',
                  borderWidth: 1,
                  borderColor: '#ffffff33',
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '700', color: baselineRange === '7d' ? '#000' : undefined }}>
                  7 day baseline
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setBaselineRange('30d')}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: baselineRange === '30d' ? Colors[colorScheme ?? 'light'].tint : '#ffffff22',
                  borderWidth: 1,
                  borderColor: '#ffffff33',
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '700', color: baselineRange === '30d' ? '#000' : undefined }}>
                  30 day baseline
                </Text>
              </Pressable>
            </View>

            <Text style={{ marginBottom: 6 }}>user_id</Text>
            <TextInput
              value={emuUserId}
              onChangeText={(t) => {
                setEmuUserId(t);
                void resolveUserForEmulation(t);
              }}
              placeholder="linked user uid"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: '#99999966',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                color: Colors[colorScheme ?? 'light'].text,
              }}
            />

            <Text style={{ marginBottom: 6 }}>device_id (auto)</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#99999966',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                opacity: 0.9,
              }}
            >
              <Text>{emuResolvedDeviceId || (emuResolveLoading ? 'Loading...' : '--')}</Text>
            </View>

            <Text style={{ marginBottom: 6 }}>displayName (auto)</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#99999966',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                opacity: 0.9,
              }}
            >
              <Text>{emuResolvedDisplayName || (emuResolveLoading ? 'Loading...' : '--')}</Text>
            </View>

            <Pressable
              onPress={async () => {
                const uid = emuUserId.trim();
                if (!uid) {
                  Alert.alert('Missing user_id', 'Enter a user_id first.');
                  return;
                }
                if (!emuResolvedDeviceId || !emuResolvedDisplayName) {
                  Alert.alert('Missing user data', 'Could not resolve device_id / displayName for that user.');
                  return;
                }
                await addEmulationDevice({
                  userId: uid,
                  deviceId: emuResolvedDeviceId,
                  label: emuResolvedDisplayName,
                });
                setEmuUserId('');
                setEmuResolvedDeviceId('');
                setEmuResolvedDisplayName('');
                await refreshEmulationDevices();
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: Colors[colorScheme ?? 'light'].tint,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700', textAlign: 'center' }}>Add Simulated Device</Text>
            </Pressable>

            {emulationDevices.length === 0 ? (
              <Text style={styles.subtitle}>No simulated devices added yet.</Text>
            ) : (
              emulationDevices.map((d) => (
                <View
                  key={`${d.userId}__${d.deviceId}`}
                  style={{
                    borderWidth: 1,
                    borderColor: '#99999944',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>{d.label ?? d.deviceId}</Text>
                  <Text>device_id: {d.deviceId}</Text>
                  <Text>user_id: {d.userId}</Text>

                  <EmulationComparison
                    userId={d.userId}
                    deviceId={d.deviceId}
                    emuKey={emuKeyFor(d.userId, d.deviceId)}
                    range={baselineRange}
                    currentHr={effectiveDeviceHeartRates.get(emuKeyFor(d.userId, d.deviceId)) ?? null}
                    simWorkoutActive={simWorkoutActive}
                    simSeconds={simWorkoutSeconds}
                  />

                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontWeight: '700' }}>HR</Text>
                      <Text>{Math.round((emuHrOverrides[emuKeyFor(d.userId, d.deviceId)] ?? 120) as number)} bpm</Text>
                    </View>
                    <Slider
                      minimumValue={40}
                      maximumValue={220}
                      step={1}
                      value={(emuHrOverrides[emuKeyFor(d.userId, d.deviceId)] ?? 120) as number}
                      minimumTrackTintColor={Colors[colorScheme ?? 'light'].tint}
                      maximumTrackTintColor={'#99999966'}
                      thumbTintColor={Colors[colorScheme ?? 'light'].tint}
                      onValueChange={(v: number) => {
                        setEmuHrOverrides((prev) => ({ ...prev, [emuKeyFor(d.userId, d.deviceId)]: v }));
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={() => {
                      const doRemove = async () => {
                        await removeEmulationDevice(d.deviceId, d.userId);
                        await refreshEmulationDevices();
                        setEmuHrOverrides((prev) => {
                          const next = { ...prev };
                          delete next[emuKeyFor(d.userId, d.deviceId)];
                          return next;
                        });
                      };

                      // Web: Alert confirmations can be flaky; use window.confirm.
                      if (typeof window !== 'undefined') {
                        const ok = window.confirm(`Remove ${d.deviceId}?`);
                        if (ok) void doRemove();
                        return;
                      }

                      // Native fallback
                      Alert.alert('Remove device?', `Remove ${d.deviceId}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => void doRemove() },
                      ]);
                    }}
                    style={{
                      marginTop: 10,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: '#ff000022',
                      borderWidth: 1,
                      borderColor: '#ff000033',
                    }}
                  >
                    <Text style={{ textAlign: 'center', fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}

            {emulationDevices.length > 0 && (
              <Pressable
                onPress={() => {
                  Alert.alert('Clear all simulated devices?', 'This only clears local emulation storage.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear All',
                      style: 'destructive',
                      onPress: () => {
                        void (async () => {
                          await clearEmulationDevices();
                          await refreshEmulationDevices();
                        })();
                      },
                    },
                  ]);
                }}
                style={{
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: '#ff000022',
                  borderWidth: 1,
                  borderColor: '#ff000033',
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '700' }}>Clear All</Text>
              </Pressable>
            )}

            <View
              style={{
                borderWidth: 1,
                borderColor: '#ffffff22',
                backgroundColor: '#00000022',
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
              }}
            >
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>Elapsed time</Text>
              <Text style={{ opacity: 0.85 }}>
                {simWorkoutActive ? formatElapsed(simWorkoutSeconds) : '--:--'}
              </Text>
            </View>

          </View>
        )}

        <ConnectedDevicesList
          connectedDevices={effectiveConnectedDevices}
          deviceHeartRates={effectiveDeviceHeartRates}
          deviceOwners={deviceOwners}
          onDisconnect={handleDisconnectDevice}
          onDisconnectAll={handleDisconnectAll}
          aggregateHeartRate={aggregateHeartRate}
          currentZone={workoutMetrics?.currentZone}
        />

        {!emulate && (
          <MultiDeviceScanner
            isScanning={isScanning}
            bluetoothEnabled={bluetoothEnabled}
            availableDevices={availableDevices}
            connectedDevices={effectiveConnectedDevices}
            deviceOwners={deviceOwners}
            onScan={handleScan}
            onConnect={handleConnect}
          />
        )}

        <MultiDeviceControls
          workoutActive={emulate ? simWorkoutActive : workoutActive}
          workoutPaused={workoutPaused}
          pauseReason={pauseReason}
          hasConnectedDevices={emulate ? emulationDevices.length > 0 : effectiveConnectedDevices.length > 0}
          onStart={handleStartWorkout}
          onPause={pauseWorkout}
          onResume={resumeWorkout}
          onEnd={handleEndWorkout}
          startLabel={emulate ? 'Start Simulated Connection' : 'Start Group Workout'}
        />

        {workoutActive && workoutMetrics && (
          <GroupMetrics
            duration={workoutMetrics.duration}
            averageHeartRate={workoutMetrics.averageHeartRate}
            maxHeartRate={workoutMetrics.maxHeartRate}
            caloriesBurned={workoutMetrics.caloriesBurned}
          />
        )}

        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <View style={styles.countdownBox}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>Starting workout...</Text>
            </View>
          </View>
        )}

        {isScanning && availableDevices.length === 0 && (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="small" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
