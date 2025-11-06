import React, { useEffect } from 'react';
import { ScrollView, Pressable, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useMultiDeviceWorkout } from '@/src/hooks/useMultiDeviceWorkout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Device } from 'react-native-ble-plx';
import { liveStyles as styles } from '@/src/styles';
import { DeviceHeartRateCard } from '@/components/fitness/DeviceHeartRateCard';

export default function MultiDeviceLiveWorkoutScreen() {
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

  useEffect(() => {
    checkBluetoothStatus();
  }, []);

  const handleScan = async () => {
    if (!bluetoothEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices.');
      return;
    }
    await scanForDevices();
  };

  const handleConnect = async (device: Device) => {
    try {
      await connectToDevice(device);
      Alert.alert('Connected', `Connected to ${device.name || device.id}`);
    } catch (err) {
      Alert.alert('Connection Failed', 'Could not connect to device. Please try again.');
    }
  };

  const handleDisconnectDevice = async (deviceId: string, deviceName?: string) => {
    Alert.alert(
      'Disconnect',
      `Disconnect from ${deviceName || 'this device'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectDevice(deviceId);
          },
        },
      ]
    );
  };

  const handleDisconnectAll = async () => {
    Alert.alert(
      'Disconnect All',
      'Are you sure you want to disconnect all devices?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect All',
          style: 'destructive',
          onPress: async () => {
            await disconnectAll();
            Alert.alert('Disconnected', 'All devices disconnected successfully');
          },
        },
      ]
    );
  };

  const handleStartWorkout = () => {
    startWorkout();
  };

  const handleEndWorkout = () => {
    Alert.alert(
      'End Workout',
      'Are you sure you want to end this workout?',
      [
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
      ]
    );
  };

  const getHeartRateZoneColor = (zone: number): string => {
    switch (zone) {
      case 1: return '#60A5FA'; // Light blue
      case 2: return '#34D399'; // Green
      case 3: return '#FBBF24'; // Yellow
      case 4: return '#F97316'; // Orange
      case 5: return '#EF4444'; // Red
      default: return '#9CA3AF'; // Gray
    }
  };

  const renderDevice = ({ item }: { item: Device }) => (
    <Pressable
      style={styles.deviceItem}
      onPress={() => handleConnect(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <Text style={styles.connectText}>Connect →</Text>
    </Pressable>
  );

  // Calculate aggregate heart rate from all devices
  const aggregateHeartRate = connectedDevices.length > 0 
    ? (() => {
        const validHRs = Array.from(deviceHeartRates.values()).filter((hr): hr is number => hr !== null && hr > 0);
        if (validHRs.length === 0) return null;
        return Math.round(validHRs.reduce((sum, hr) => sum + hr, 0) / validHRs.length);
      })()
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Multi-Device Workout</Text>
        <Text style={styles.subtitle}>Connect multiple Polar watches for team tracking</Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Connected Devices */}
      {connectedDevices.length > 0 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>
              Connected Devices ({connectedDevices.length})
            </Text>
            {connectedDevices.length > 1 && (
              <Pressable onPress={handleDisconnectAll}>
                <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>
                  Disconnect All
                </Text>
              </Pressable>
            )}
          </View>
          
          {connectedDevices.map((deviceInfo) => (
            <DeviceHeartRateCard
              key={deviceInfo.device.id}
              deviceInfo={deviceInfo}
              heartRate={deviceHeartRates.get(deviceInfo.device.id) || null}
              onDisconnect={() => handleDisconnectDevice(deviceInfo.device.id, deviceInfo.device.name || undefined)}
              compact={connectedDevices.length > 2}
            />
          ))}

          {/* Aggregate Heart Rate */}
          {connectedDevices.length > 1 && (
            <View style={[styles.heartRateSection, { marginTop: 12, backgroundColor: '#0F172A' }]}>
              <Text style={styles.heartRateLabel}>Team Average Heart Rate</Text>
              <View style={styles.heartRateDisplay}>
                <Text style={styles.heartRateValue}>
                  {aggregateHeartRate || '--'}
                </Text>
                <Text style={styles.heartRateUnit}>bpm</Text>
                <Text style={styles.heartIcon}>👥❤️</Text>
              </View>
              {workoutMetrics && (
                <View style={[styles.zoneIndicator, { backgroundColor: getHeartRateZoneColor(workoutMetrics.currentZone) }]}>
                  <Text style={styles.zoneText}>Zone {workoutMetrics.currentZone}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add More Devices</Text>
        
        {!bluetoothEnabled && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              📱 Bluetooth is disabled. Please enable it in your device settings.
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.scanButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint },
            isScanning && styles.scanButtonDisabled,
          ]}
          onPress={handleScan}
          disabled={isScanning || !bluetoothEnabled}
        >
          {isScanning ? (
            <ActivityIndicator color="#000000ff" />
          ) : (
            <Text style={styles.scanButtonText}>
              {availableDevices.length > 0 ? 'Scan Again' : 'Scan for Polar Devices'}
            </Text>
          )}
        </Pressable>

        {availableDevices.length > 0 && (
          <>
            <Text style={styles.devicesFoundText}>
              Found {availableDevices.length} device{availableDevices.length !== 1 ? 's' : ''}
            </Text>
            <FlatList
              data={availableDevices.filter(d => !connectedDevices.find(cd => cd.device.id === d.id))}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 16 }}>
                  All found devices are already connected
                </Text>
              }
            />
          </>
        )}
      </View>

      {/* Workout Controls */}
      {connectedDevices.length > 0 && (
        <View style={styles.section}>
          {!workoutActive ? (
            <>
              <Pressable
                style={[styles.workoutButton, styles.startButton]}
                onPress={handleStartWorkout}
              >
                <Text style={styles.workoutButtonText}>▶️ Start Workout</Text>
              </Pressable>
              <Text style={styles.autoStartHint}>
                💡 Tip: Workout will auto-start when heart rate is detected
              </Text>
            </>
          ) : (
            <>
              <View style={styles.buttonRow}>
                {workoutPaused ? (
                  <Pressable
                    style={[styles.workoutButton, styles.resumeButton]}
                    onPress={resumeWorkout}
                  >
                    <Text style={styles.workoutButtonText}>▶️ Resume</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.workoutButton, styles.pauseButton]}
                    onPress={pauseWorkout}
                  >
                    <Text style={styles.workoutButtonText}>⏸️ Pause</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.workoutButton, styles.endButton]}
                  onPress={handleEndWorkout}
                >
                  <Text style={styles.workoutButtonText}>⏹️ End</Text>
                </Pressable>
              </View>
              {pauseReason && (
                <Text style={styles.pauseReasonText}>{pauseReason}</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Workout Metrics */}
      {workoutActive && workoutMetrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {Math.floor(workoutMetrics.duration / 60)}:{(workoutMetrics.duration % 60).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.metricLabel}>Duration</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{workoutMetrics.averageHeartRate}</Text>
              <Text style={styles.metricLabel}>Avg HR</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{workoutMetrics.maxHeartRate}</Text>
              <Text style={styles.metricLabel}>Max HR</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{workoutMetrics.caloriesBurned}</Text>
              <Text style={styles.metricLabel}>Calories</Text>
            </View>
          </View>
        </View>
      )}

      {/* Previous Workout Results */}
      {!workoutActive && workoutMetrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Workout Summary</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              🏃 Duration: {Math.floor(workoutMetrics.duration / 60)} minutes {workoutMetrics.duration % 60} seconds
            </Text>
            <Text style={styles.summaryText}>
              ❤️ Average HR: {workoutMetrics.averageHeartRate} bpm
            </Text>
            <Text style={styles.summaryText}>
              📈 Max HR: {workoutMetrics.maxHeartRate} bpm
            </Text>
            <Text style={styles.summaryText}>
              📉 Min HR: {workoutMetrics.minHeartRate} bpm
            </Text>
            <Text style={styles.summaryText}>
              🔥 Calories Burned: {workoutMetrics.caloriesBurned} kcal
            </Text>
            <Text style={styles.summaryText}>
              🎯 Peak Zone: Zone {workoutMetrics.currentZone}
            </Text>
          </View>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.instructionsTitle}>How to Use Multi-Device Mode:</Text>
        <Text style={styles.instructionText}>1. Make sure all Polar watches are on and nearby</Text>
        <Text style={styles.instructionText}>2. Tap "Scan for Polar Devices"</Text>
        <Text style={styles.instructionText}>3. Connect to each device one by one</Text>
        <Text style={styles.instructionText}>4. Start your workout to track all devices together</Text>
        <Text style={styles.instructionText}>5. Heart rates will update in real-time for all connected devices</Text>
        <Text style={styles.instructionText}>6. View team average and individual heart rates</Text>
      </View>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownBox}>
            <Text style={styles.countdownText}>{countdown}</Text>
            <Text style={styles.countdownLabel}>Starting workout...</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
