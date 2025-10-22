import { BleManager, Device, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

// Polar H10 Heart Rate Service UUID (Standard BLE Heart Rate Service)
const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

// Polar Device Name patterns
const POLAR_DEVICE_PREFIXES = ['Polar', 'H10', 'H9', 'OH1', 'Verity Sense'];

export interface HeartRateReading {
  heartRate: number;
  timestamp: Date;
  energyExpended?: number;
  rrIntervals?: number[];
}

export interface WorkoutMetrics {
  duration: number; // seconds
  averageHeartRate: number;
  maxHeartRate: number;
  minHeartRate: number;
  caloriesBurned: number;
  currentZone: 1 | 2 | 3 | 4 | 5;
}

class BluetoothService {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private heartRateReadings: HeartRateReading[] = [];
  private listeners: Map<string, (data: HeartRateReading) => void> = new Map();
  private workoutStartTime: Date | null = null;

  constructor() {
    // Manager will be initialized when needed (requires development build)
  }

  /**
   * Initialize BLE Manager
   */
  private initializeManager(): void {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (error) {
        console.error('Failed to initialize BLE Manager:', error);
        console.error('Note: BLE requires a development build. See BUILD_INSTRUCTIONS.md');
      }
    }
  }

  /**
   * Get the BLE manager, initializing if needed
   */
  private getManager(): BleManager {
    if (!this.manager) {
      this.initializeManager();
    }
    if (!this.manager) {
      throw new Error('BLE Manager could not be initialized. You need a development build to use Bluetooth. See BUILD_INSTRUCTIONS.md');
    }
    return this.manager;
  }

  /**
   * Request Bluetooth permissions for Android
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        
        return (
          permissions['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          permissions['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          permissions['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handles permissions automatically
  }

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled(): Promise<boolean> {
    try {
      const manager = this.getManager();
      const state = await manager.state();
      return state === State.PoweredOn;
    } catch (error) {
      console.error('Failed to check Bluetooth state:', error);
      return false;
    }
  }

  /**
   * Scan for nearby Polar devices
   */
  async scanForDevices(
    onDeviceFound: (device: Device) => void,
    durationMs: number = 10000
  ): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Bluetooth permissions not granted');
    }

    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is not enabled');
    }

    const foundDevices = new Set<string>();
    const manager = this.getManager();

    // Scan for all devices (null) instead of filtering by service UUID
    // This improves discovery as some Polar devices don't advertise HR service in scan response
    manager.startDeviceScan(
      null, // Scan all devices, we'll filter by name
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (device && device.name && !foundDevices.has(device.id)) {
          // Check if it's a Polar device by name
          const isPolarDevice = POLAR_DEVICE_PREFIXES.some(prefix =>
            device.name?.toLowerCase().includes(prefix.toLowerCase())
          );

          if (isPolarDevice) {
            foundDevices.add(device.id);
            onDeviceFound(device);
          }
        }
      }
    );

    // Stop scanning after duration
    setTimeout(() => {
      manager.stopDeviceScan();
    }, durationMs);
  }

  /**
   * Connect to a Polar device
   */
  async connectToDevice(device: Device): Promise<void> {
    try {
      // Disconnect any existing device
      if (this.connectedDevice) {
        await this.disconnect();
      }

      console.log('Connecting to device:', device.name);
      
      const connected = await device.connect();
      console.log('Connected! Discovering services...');
      
      await connected.discoverAllServicesAndCharacteristics();
      console.log('Services discovered!');
      
      this.connectedDevice = connected;

      // Start monitoring heart rate
      await this.startHeartRateMonitoring();
    } catch (error) {
      console.error('Connection error:', error);
      throw new Error(`Failed to connect to device: ${error}`);
    }
  }

  /**
   * Start monitoring heart rate data
   */
  private async startHeartRateMonitoring(): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    this.connectedDevice.monitorCharacteristicForService(
      HEART_RATE_SERVICE_UUID,
      HEART_RATE_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('Heart rate monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          const heartRateData = this.parseHeartRateData(characteristic.value);
          this.heartRateReadings.push(heartRateData);

          // Notify all listeners
          this.listeners.forEach(callback => callback(heartRateData));
        }
      }
    );
  }

  /**
   * Parse heart rate data from BLE characteristic
   */
  private parseHeartRateData(value: string): HeartRateReading {
    if (!value) {
      throw new Error('No value in characteristic');
    }

    // Decode base64 to binary
    const data = Buffer.from(value, 'base64');
    
    // Parse according to BLE Heart Rate Measurement format
    const flags = data[0];
    const is16Bit = (flags & 0x01) === 1;
    
    let heartRate: number;
    let offset = 1;
    
    if (is16Bit) {
      heartRate = data.readUInt16LE(offset);
      offset += 2;
    } else {
      heartRate = data[offset];
      offset += 1;
    }

    // Optional: Energy Expended
    let energyExpended: number | undefined;
    if (flags & 0x08) {
      energyExpended = data.readUInt16LE(offset);
      offset += 2;
    }

    // Optional: RR Intervals
    const rrIntervals: number[] = [];
    if (flags & 0x10) {
      while (offset < data.length) {
        const rr = data.readUInt16LE(offset);
        rrIntervals.push(rr);
        offset += 2;
      }
    }

    return {
      heartRate,
      timestamp: new Date(),
      energyExpended,
      rrIntervals: rrIntervals.length > 0 ? rrIntervals : undefined,
    };
  }

  /**
   * Subscribe to heart rate updates
   */
  subscribeToHeartRate(
    id: string,
    callback: (data: HeartRateReading) => void
  ): () => void {
    this.listeners.set(id, callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(id);
    };
  }

  /**
   * Start a workout session
   */
  startWorkout(): void {
    this.workoutStartTime = new Date();
    this.heartRateReadings = [];
  }

  /**
   * Get current workout metrics
   */
  getWorkoutMetrics(): WorkoutMetrics | null {
    if (!this.workoutStartTime || this.heartRateReadings.length === 0) {
      return null;
    }

    const duration = Math.floor((Date.now() - this.workoutStartTime.getTime()) / 1000);
    const heartRates = this.heartRateReadings.map(r => r.heartRate);
    
    const averageHeartRate = Math.round(
      heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length
    );
    const maxHeartRate = Math.max(...heartRates);
    const minHeartRate = Math.min(...heartRates);

    // Simple calorie calculation (very rough estimate)
    // Formula: ((Age - Gender Factor) * 0.074) - 20.4 * Weight + 4.93 * HR) * Duration / 4.184
    // Simplified: Average HR * duration * 0.1
    const caloriesBurned = Math.round(averageHeartRate * duration * 0.1 / 60);

    // Determine heart rate zone (simplified)
    const maxHR = 220 - 30; // Assuming age 30, adjust as needed
    const hrPercentage = (averageHeartRate / maxHR) * 100;
    
    let currentZone: 1 | 2 | 3 | 4 | 5;
    if (hrPercentage < 60) currentZone = 1;
    else if (hrPercentage < 70) currentZone = 2;
    else if (hrPercentage < 80) currentZone = 3;
    else if (hrPercentage < 90) currentZone = 4;
    else currentZone = 5;

    return {
      duration,
      averageHeartRate,
      maxHeartRate,
      minHeartRate,
      caloriesBurned,
      currentZone,
    };
  }

  /**
   * End workout session and return final metrics
   */
  endWorkout(): WorkoutMetrics | null {
    const metrics = this.getWorkoutMetrics();
    this.workoutStartTime = null;
    this.heartRateReadings = [];
    return metrics;
  }

  /**
   * Get the currently connected device
   */
  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  /**
   * Check if a device is connected
   */
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  /**
   * Disconnect from the current device
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        const manager = this.getManager();
        await manager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        this.listeners.clear();
        console.log('Disconnected from device');
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
  }

  /**
   * Cleanup and destroy manager
   */
  destroy(): void {
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }
}

export default new BluetoothService();
