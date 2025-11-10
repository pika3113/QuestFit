import { useState, useEffect, useCallback, useRef } from 'react';
import { Device } from 'react-native-ble-plx';
import { Alert } from 'react-native';
import bluetoothService, { HeartRateReading, WorkoutMetrics, ConnectedDeviceInfo } from '../services/bluetoothService';

export const useMultiDeviceWorkout = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDeviceInfo[]>([]);
  const [deviceHeartRates, setDeviceHeartRates] = useState<Map<string, number | null>>(new Map());
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

  // Update connected devices list periodically
  useEffect(() => {
    const updateConnectedDevices = () => {
      const devices = bluetoothService.getConnectedDevices();
      setConnectedDevices(devices);
    };

    // Update immediately
    updateConnectedDevices();

    // Update every second to get latest heart rates
    const interval = setInterval(updateConnectedDevices, 1000);

    return () => clearInterval(interval);
  }, []);

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

  // Subscribe to heart rate updates from all connected devices
  useEffect(() => {
    if (connectedDevices.length > 0) {
      console.log('📡 Subscribing to heart rate updates from', connectedDevices.length, 'devices');
      
      const unsubscribe = bluetoothService.subscribeToHeartRate(
        'multi-device-workout-hook',
        (data: HeartRateReading) => {
          console.log('💓 Heart rate update received:', data.heartRate, 'bpm from', data.deviceName || data.deviceId);
          
          // Update device heart rates map
          setDeviceHeartRates(prev => {
            const newMap = new Map(prev);
            newMap.set(data.deviceId, data.heartRate);
            return newMap;
          });
          
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
      console.log('❌ No connected devices, cannot subscribe to heart rate');
      setDeviceHeartRates(new Map());
    }
  }, [connectedDevices.length, workoutActive, countdownActive, startCountdown]);

  // Monitor for HR timeout (no data received for 5 seconds during workout)
  useEffect(() => {
    if (workoutActive && !workoutPaused && connectedDevices.length > 0) {
      // Clear any existing timeout
      if (heartRateTimeoutRef.current) {
        clearInterval(heartRateTimeoutRef.current);
      }

      // Check every 2 seconds if we've received HR data
      heartRateTimeoutRef.current = setInterval(() => {
        const timeSinceLastHR = Date.now() - lastHeartRateTime.current;
        
        // If no HR data for 5 seconds, auto-pause workout
        if (timeSinceLastHR > 5000) {
          console.log('⚠️ No heart rate data received for 5 seconds');
          // Reset all HR displays to null
          setDeviceHeartRates(prev => {
            const newMap = new Map(prev);
            prev.forEach((_, deviceId) => newMap.set(deviceId, null));
            return newMap;
          });
          // Backdate the pause to when we last received HR
          bluetoothService.pauseWorkout(lastHeartRateTime.current);
          setWorkoutPaused(true);
          setPauseReason('Paused as no heart rate signal detected for 5 seconds');
        }
      }, 2000); // Check every 2 seconds

      return () => {
        if (heartRateTimeoutRef.current) {
          clearInterval(heartRateTimeoutRef.current);
        }
      };
    }

    return undefined;
  }, [workoutActive, workoutPaused, connectedDevices.length]);

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
      
      // Update connected devices list
      const devices = bluetoothService.getConnectedDevices();
      setConnectedDevices(devices);
      
      console.log('📱 Connected devices updated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to device';
      console.error('❌ Connection error:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      await bluetoothService.disconnectDevice(deviceId);
      
      // Update connected devices list
      const devices = bluetoothService.getConnectedDevices();
      setConnectedDevices(devices);
      
      // Remove from heart rates map
      setDeviceHeartRates(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceId);
        return newMap;
      });
      
      // End workout if no devices left and workout is active
      if (devices.length === 0 && workoutActive) {
        const finalMetrics = bluetoothService.endWorkout();
        setWorkoutMetrics(finalMetrics);
        setWorkoutActive(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect device');
      console.error('Disconnect error:', err);
    }
  }, [workoutActive]);

  const disconnectAll = useCallback(async () => {
    try {
      setError(null);
      await bluetoothService.disconnect();
      setConnectedDevices([]);
      setDeviceHeartRates(new Map());
      
      // End workout if active
      if (workoutActive) {
        const finalMetrics = bluetoothService.endWorkout();
        setWorkoutMetrics(finalMetrics);
        setWorkoutActive(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect all devices');
      console.error('Disconnect error:', err);
    }
  }, [workoutActive]);

  const startWorkout = useCallback(() => {
    if (connectedDevices.length === 0) {
      setError('No devices connected. Please connect to at least one Polar device first.');
      return;
    }

    bluetoothService.startWorkout();
    setWorkoutActive(true);
    setWorkoutPaused(false);
    setPauseReason(null);
    setWorkoutMetrics(null);
    setError(null);
  }, [connectedDevices.length]);

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
    connectedDevices,
    deviceHeartRates,
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
    disconnectDevice,
    disconnectAll,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    endWorkout,
    checkBluetoothStatus,
  };
};
