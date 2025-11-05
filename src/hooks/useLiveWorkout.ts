import { useState, useEffect, useCallback, useRef } from 'react';
import { Device } from 'react-native-ble-plx';
import { Alert } from 'react-native';
import bluetoothService, { HeartRateReading, WorkoutMetrics } from '../services/bluetoothService';

export const useLiveWorkout = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [workoutActive, setWorkoutActive] = useState(false);
  const [workoutPaused, setWorkoutPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [workoutMetrics, setWorkoutMetrics] = useState<WorkoutMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  
  // Track last HR update time
  const lastHeartRateTime = useRef<number>(Date.now());
  const heartRateTimeoutRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

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

  // Handle countdown separately
  const startCountdown = useCallback(() => {
    console.log('🏃 Starting 3 second countdown...');
    setCountdownActive(true);
    setCountdown(3);
    
    setTimeout(() => {
      console.log('Countdown: 2');
      setCountdown(2);
      
      setTimeout(() => {
        console.log('Countdown: 1');
        setCountdown(1);
        
        setTimeout(() => {
          console.log('🏃 Auto-starting workout!');
          setCountdown(null);
          setCountdownActive(false);
          bluetoothService.startWorkout();
          setWorkoutActive(true);
          setWorkoutMetrics(null);
        }, 1000);
      }, 1000);
    }, 1000);
  }, []);

  // Subscribe to heart rate updates when connected
  useEffect(() => {
    if (connectedDevice) {
      console.log('📡 Subscribing to heart rate updates for:', connectedDevice.name);
      
      const unsubscribe = bluetoothService.subscribeToHeartRate(
        'live-workout-hook',
        (data: HeartRateReading) => {
          console.log('💓 Heart rate update received:', data.heartRate, 'bpm');
          setCurrentHeartRate(data.heartRate);
          
          // Update last HR time
          lastHeartRateTime.current = Date.now();
          
          // Auto-start workout with countdown if HR data is received but workout not active
          if (!workoutActive && data.heartRate > 0 && !countdownActive) {
            startCountdown();
          }
          
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
        console.log('🔌 Unsubscribing from heart rate updates');
        unsubscribe();
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      };
    } else {
      console.log('❌ No connected device, cannot subscribe to heart rate');
      setCurrentHeartRate(null);
    }
  }, [connectedDevice, workoutActive, countdownActive]);

  // Monitor for HR timeout (no data received for 10 seconds during workout)
  useEffect(() => {
    if (workoutActive && !workoutPaused && connectedDevice) {
      // Clear any existing timeout
      if (heartRateTimeoutRef.current) {
        clearInterval(heartRateTimeoutRef.current);
      }

      // Check every 2 seconds if we've received HR data
      heartRateTimeoutRef.current = setInterval(() => {
        const timeSinceLastHR = Date.now() - lastHeartRateTime.current;
        
        // If no HR data for 5 seconds, reset HR display and auto-pause workout
        if (timeSinceLastHR > 5000) {
          console.log('⚠️ No heart rate data received for 5 seconds');
          setCurrentHeartRate(null); // Reset HR to '--'
          // Backdate the pause to when we last received HR
          bluetoothService.pauseWorkout(lastHeartRateTime.current);
          setWorkoutPaused(true);
          setPauseReason('Pause as no heart rate signal detected for 5 seconds');
        }
      }, 2000); // Check every 2 seconds

      return () => {
        if (heartRateTimeoutRef.current) {
          clearInterval(heartRateTimeoutRef.current);
        }
      };
    }

    return undefined;
  }, [workoutActive, workoutPaused, connectedDevice]);

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
      console.log('🔗 Attempting to connect to:', device.name, '(', device.id, ')');
      
      await bluetoothService.connectToDevice(device);
      
      console.log('✅ Successfully connected to:', device.name);
      setConnectedDevice(device);
      
      console.log('📱 Connected device state updated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to device';
      console.error('❌ Connection error:', errorMessage);
      setError(errorMessage);
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
    setWorkoutPaused(false);
    setPauseReason(null);
    setWorkoutMetrics(null);
    setError(null);
  }, [connectedDevice]);

  const pauseWorkout = useCallback(() => {
    bluetoothService.pauseWorkout();
    setWorkoutPaused(true);
    setPauseReason(null); // User manually paused, no reason
  }, []);

  const resumeWorkout = useCallback(() => {
    bluetoothService.resumeWorkout();
    setWorkoutPaused(false);
    setPauseReason(null);
    lastHeartRateTime.current = Date.now(); // Reset timer
  }, []);

  const endWorkout = useCallback(() => {
    const finalMetrics = bluetoothService.endWorkout();
    setWorkoutMetrics(finalMetrics);
    setWorkoutActive(false);
    setWorkoutPaused(false);
    setPauseReason(null);
    return finalMetrics;
  }, []);

  return {
    // State
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
    
    // Actions
    scanForDevices,
    connectToDevice,
    disconnect,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    endWorkout,
    checkBluetoothStatus,
  };
};
