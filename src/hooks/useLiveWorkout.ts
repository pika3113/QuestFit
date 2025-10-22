import { useState, useEffect, useCallback } from 'react';
import { Device } from 'react-native-ble-plx';
import bluetoothService, { HeartRateReading, WorkoutMetrics } from '../services/bluetoothService';

export const useLiveWorkout = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [workoutActive, setWorkoutActive] = useState(false);
  const [workoutMetrics, setWorkoutMetrics] = useState<WorkoutMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);

  // Check Bluetooth status on mount
  useEffect(() => {
    checkBluetoothStatus();
  }, []);

  const checkBluetoothStatus = async () => {
    try {
      const enabled = await bluetoothService.isBluetoothEnabled();
      setBluetoothEnabled(enabled);
    } catch (err) {
      console.error('Failed to check Bluetooth status:', err);
      setBluetoothEnabled(false);
    }
  };

  // Subscribe to heart rate updates when connected
  useEffect(() => {
    if (connectedDevice) {
      const unsubscribe = bluetoothService.subscribeToHeartRate(
        'live-workout-hook',
        (data: HeartRateReading) => {
          setCurrentHeartRate(data.heartRate);
          
          // Update workout metrics if workout is active
          if (workoutActive) {
            const metrics = bluetoothService.getWorkoutMetrics();
            if (metrics) {
              setWorkoutMetrics(metrics);
            }
          }
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [connectedDevice, workoutActive]);

  const scanForDevices = useCallback(async () => {
    try {
      setIsScanning(true);
      setAvailableDevices([]);
      setError(null);

      await bluetoothService.scanForDevices(
        (device) => {
          setAvailableDevices(prev => {
            // Avoid duplicates
            if (prev.find(d => d.id === device.id)) {
              return prev;
            }
            return [...prev, device];
          });
        },
        10000 // 10 second scan
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for devices');
      console.error('Scan error:', err);
    } finally {
      setTimeout(() => setIsScanning(false), 10000);
    }
  }, []);

  const connectToDevice = useCallback(async (device: Device) => {
    try {
      setError(null);
      await bluetoothService.connectToDevice(device);
      setConnectedDevice(device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to device');
      console.error('Connection error:', err);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      await bluetoothService.disconnect();
      setConnectedDevice(null);
      setCurrentHeartRate(null);
      
      // End workout if active
      if (workoutActive) {
        const finalMetrics = bluetoothService.endWorkout();
        setWorkoutMetrics(finalMetrics);
        setWorkoutActive(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      console.error('Disconnect error:', err);
    }
  }, [workoutActive]);

  const startWorkout = useCallback(() => {
    if (!connectedDevice) {
      setError('No device connected. Please connect to a Polar device first.');
      return;
    }

    bluetoothService.startWorkout();
    setWorkoutActive(true);
    setWorkoutMetrics(null);
    setError(null);
  }, [connectedDevice]);

  const endWorkout = useCallback(() => {
    const finalMetrics = bluetoothService.endWorkout();
    setWorkoutMetrics(finalMetrics);
    setWorkoutActive(false);
    return finalMetrics;
  }, []);

  return {
    // State
    isScanning,
    availableDevices,
    connectedDevice,
    currentHeartRate,
    workoutActive,
    workoutMetrics,
    error,
    bluetoothEnabled,
    
    // Actions
    scanForDevices,
    connectToDevice,
    disconnect,
    startWorkout,
    endWorkout,
    checkBluetoothStatus,
  };
};
