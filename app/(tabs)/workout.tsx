import React, { useEffect, useState } from 'react';
import { ScrollView, Pressable, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLiveWorkout } from '@/src/hooks/useLiveWorkout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Device } from 'react-native-ble-plx';
import { liveStyles as styles } from '@/src/styles';
import { useAuth } from '@/src/hooks/useAuth';
import workoutCompletionService from '@/src/services/workoutCompletionService';
import { CreatureUnlockModal } from '@/components/game/CreatureUnlockModal';
import { Creature } from '@/src/types/polar';

export default function LiveWorkoutScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockedCreatures, setUnlockedCreatures] = useState<Creature[]>([]);
  const [isProcessingWorkout, setIsProcessingWorkout] = useState(false);
  const [workoutType, setWorkoutType] = useState<'RUNNING' | 'CYCLING' | 'SWIMMING' | 'FITNESS' | 'HIKING' | 'WALKING'>('FITNESS');

  const {
    isScanning,
    availableDevices,
    connectedDevice,
    currentHeartRate,
    workoutActive,
    workoutPaused,
    pauseReason,
    countdown,
    workoutMetrics,
    error,
    bluetoothEnabled,
    scanForDevices,
    connectToDevice,
    disconnect,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    endWorkout,
    checkBluetoothStatus,
  } = useLiveWorkout();

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

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            Alert.alert('Disconnected', 'Device disconnected successfully');
          },
        },
      ]
    );
  };

  const handleStartWorkout = () => {
    startWorkout();
  };

  const handleEndWorkout = async () => {
    Alert.alert(
      'End Workout',
      'Are you sure you want to end this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Workout',
          style: 'destructive',
          onPress: async () => {
            const metrics = endWorkout();
            if (metrics && user) {
              setIsProcessingWorkout(true);
              try {
                // time to process the workout and give them XP and creatures
                const result = await workoutCompletionService.completeLiveWorkout(
                  user.uid,
                  metrics,
                  workoutType
                );

                // if they caught any creatures show the unlock modal
                if (result.unlockedCreatures.length > 0) {
                  setUnlockedCreatures(result.unlockedCreatures);
                  setShowUnlockModal(true);
                }

                // display a nice summary of what they accomplished
                const summary = workoutCompletionService.getWorkoutSummary(result);
                Alert.alert('Workout Complete!', summary);
              } catch (error) {
                console.error('Error processing workout:', error);
                Alert.alert(
                  'Workout Saved',
                  `Duration: ${Math.floor(metrics.duration / 60)}m ${metrics.duration % 60}s\n` +
                  `Avg HR: ${metrics.averageHeartRate} bpm\n` +
                  `Max HR: ${metrics.maxHeartRate} bpm\n` +
                  `Calories: ${metrics.caloriesBurned} kcal\n\n` +
                  `Note: Could not process rewards. Please check your connection.`
                );
              } finally {
                setIsProcessingWorkout(false);
              }
            } else if (metrics) {
              Alert.alert(
                'Workout Complete!',
                `Duration: ${Math.floor(metrics.duration / 60)}m ${metrics.duration % 60}s\n` +
                `Avg HR: ${metrics.averageHeartRate} bpm\n` +
                `Max HR: ${metrics.maxHeartRate} bpm\n` +
                `Calories: ${metrics.caloriesBurned} kcal\n\n` +
                `Sign in to earn XP and unlock creatures!`
              );
            }
          },
        },
      ]
    );
  };

  const getHeartRateZoneColor = (zone: number): string => {
    switch (zone) {
      case 1: return '#60A5FA'; // nice light blue for easy zone
      case 2: return '#34D399'; // green for moderate
      case 3: return '#FBBF24'; // yellow for getting harder
      case 4: return '#F97316'; // orange for intense
      case 5: return '#EF4444'; // red for max effort
      default: return '#9CA3AF'; // gray if we dont know
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Workout</Text>
        <Text style={styles.subtitle}>Connect your Polar watch for real-time tracking</Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Connection Status */}
      {!connectedDevice ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connect Device</Text>
          
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
                data={availableDevices}
                renderItem={renderDevice}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </>
          )}
        </View>
      ) : (
        <>
          {/* connected Device Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Device</Text>
            <View style={styles.connectedBox}>
              <Text style={styles.connectedDeviceName}>
                ✓ {connectedDevice.name || connectedDevice.id}
              </Text>
              <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </Pressable>
            </View>
          </View>

          {/* heart Rate Display */}
          <View style={styles.heartRateSection}>
            <Text style={styles.heartRateLabel}>Current Heart Rate</Text>
            <View style={styles.heartRateDisplay}>
              <Text style={styles.heartRateValue}>
                {currentHeartRate || '--'}
              </Text>
              <Text style={styles.heartRateUnit}>bpm</Text>
              <Text style={styles.heartIcon}>❤️</Text>
            </View>
            {workoutMetrics && (
              <View style={[styles.zoneIndicator, { backgroundColor: getHeartRateZoneColor(workoutMetrics.currentZone) }]}>
                <Text style={styles.zoneText}>Zone {workoutMetrics.currentZone}</Text>
              </View>
            )}
          </View>

          {/* Workout Type Selector */}
          {!workoutActive && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Workout Type</Text>
              <View style={styles.workoutTypeGrid}>
                {(['RUNNING', 'CYCLING', 'SWIMMING', 'FITNESS', 'HIKING', 'WALKING'] as const).map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.workoutTypeButton,
                      workoutType === type && styles.workoutTypeButtonActive,
                    ]}
                    onPress={() => setWorkoutType(type)}
                  >
                    <Text style={[
                      styles.workoutTypeText,
                      workoutType === type && styles.workoutTypeTextActive,
                    ]}>
                      {type === 'RUNNING' && '🏃'}
                      {type === 'CYCLING' && '🚴'}
                      {type === 'SWIMMING' && '🏊'}
                      {type === 'FITNESS' && '💪'}
                      {type === 'HIKING' && '🥾'}
                      {type === 'WALKING' && '🚶'}
                    </Text>
                    <Text style={[
                      styles.workoutTypeLabel,
                      workoutType === type && styles.workoutTypeLabelActive,
                    ]}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* workout Controls */}
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
                  💡 Tip: Workout will auto-start when you enable "HR sensor mode" on your watch
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

          {/* workout metrics */}
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

          {/* previous workout results */}
          {!workoutActive && workoutMetrics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Last Workout Summary</Text>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  Duration: {Math.floor(workoutMetrics.duration / 60)} minutes {workoutMetrics.duration % 60} seconds
                </Text>
                <Text style={styles.summaryText}>
                  Average HR: {workoutMetrics.averageHeartRate} bpm
                </Text>
                <Text style={styles.summaryText}>
                  Max HR: {workoutMetrics.maxHeartRate} bpm
                </Text>
                <Text style={styles.summaryText}>
                  Min HR: {workoutMetrics.minHeartRate} bpm
                </Text>
                <Text style={styles.summaryText}>
                  Calories Burned: {workoutMetrics.caloriesBurned} kcal
                </Text>
                <Text style={styles.summaryText}>
                  Peak Zone: Zone {workoutMetrics.currentZone}
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* instructions */}
      <View style={styles.section}>
        <Text style={styles.instructionsTitle}>How to Use:</Text>
        <Text style={styles.instructionText}>1. Make sure your Polar watch is on and nearby</Text>
        <Text style={styles.instructionText}>2. Tap "Scan for Polar Devices"</Text>
        <Text style={styles.instructionText}>3. Select your device from the list</Text>
        <Text style={styles.instructionText}>4. Once connected, start your workout</Text>
        <Text style={styles.instructionText}>5. Your heart rate will update in real-time</Text>
      </View>

      {/* countdown overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownBox}>
            <Text style={styles.countdownText}>{countdown}</Text>
            <Text style={styles.countdownLabel}>Starting workout...</Text>
          </View>
        </View>
      )}

      {/* processing overlay */}
      {isProcessingWorkout && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownBox}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            <Text style={styles.countdownLabel}>Processing workout...</Text>
          </View>
        </View>
      )}

      {/* creature unlock modal */}
      <CreatureUnlockModal
        visible={showUnlockModal}
        creatures={unlockedCreatures}
        onClose={() => {
          setShowUnlockModal(false);
          setUnlockedCreatures([]);
        }}
      />
    </ScrollView>
  );
}
