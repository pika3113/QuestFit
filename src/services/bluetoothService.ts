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
  deviceId: string;
  deviceName?: string;
}

export interface WorkoutMetrics {
  duration: number; // seconds
  averageHeartRate: number;
  maxHeartRate: number;
  minHeartRate: number;
  caloriesBurned: number;
  currentZone: 1 | 2 | 3 | 4 | 5;
}

export interface ConnectedDeviceInfo {
  device: Device;
  currentHeartRate: number | null;
  lastHeartRateTime: Date | null;
  heartRateReadings: HeartRateReading[];
}

class BluetoothService {
  private manager: BleManager | null = null;
  private connectedDevices: Map<string, ConnectedDeviceInfo> = new Map();
  private listeners: Map<string, (data: HeartRateReading) => void> = new Map();
  private workoutStartTime: Date | null = null;
  private pausedTime: number = 0; // Total time spent paused in milliseconds
  private pauseStartTime: Date | null = null;

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
   * Connect to a Polar device (supports multiple devices)
   */
  async connectToDevice(device: Device): Promise<void> {
    try {
      // Check if already connected
      if (this.connectedDevices.has(device.id)) {
        console.log('Device already connected:', device.name);
        return;
      }

      console.log('Connecting to device:', device.name);
      
      const connected = await device.connect();
      console.log('Connected! Discovering services...');
      
      await connected.discoverAllServicesAndCharacteristics();
      console.log('Services discovered!');
      
      // Add to connected devices map
      this.connectedDevices.set(device.id, {
        device: connected,
        currentHeartRate: null,
        lastHeartRateTime: null,
        heartRateReadings: [],
      });

      // Start monitoring heart rate for this device
      await this.startHeartRateMonitoring(device.id);
    } catch (error) {
      console.error('Connection error:', error);
      throw new Error(`Failed to connect to device: ${error}`);
    }
  }

  /**
   * Start monitoring heart rate data for a specific device
   */
  private async startHeartRateMonitoring(deviceId: string): Promise<void> {
    const deviceInfo = this.connectedDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error('Device not found in connected devices');
    }

    console.log('🫀 Starting heart rate monitoring for:', deviceInfo.device.name);
    console.log('Service UUID:', HEART_RATE_SERVICE_UUID);
    console.log('Characteristic UUID:', HEART_RATE_CHARACTERISTIC_UUID);

    deviceInfo.device.monitorCharacteristicForService(
      HEART_RATE_SERVICE_UUID,
      HEART_RATE_CHARACTERISTIC_UUID,
      (error: any, characteristic: any) => {
        if (error) {
          console.error('❌ Heart rate monitoring error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          return;
        }

        if (characteristic?.value) {
          console.log('✅ Heart rate data received from:', deviceInfo.device.name);
          try {
            const heartRateData = this.parseHeartRateData(
              characteristic.value,
              deviceId,
              deviceInfo.device.name || undefined
            );
            console.log('📊 Parsed HR:', heartRateData.heartRate, 'bpm from', deviceInfo.device.name);
            
            // Update device info
            const currentDeviceInfo = this.connectedDevices.get(deviceId);
            if (currentDeviceInfo) {
              currentDeviceInfo.currentHeartRate = heartRateData.heartRate;
              currentDeviceInfo.lastHeartRateTime = new Date();
              currentDeviceInfo.heartRateReadings.push(heartRateData);
            }

            // Notify all listeners
            this.listeners.forEach(callback => callback(heartRateData));
          } catch (parseError) {
            console.error('❌ Failed to parse heart rate data:', parseError);
          }
        } else {
          console.warn('⚠️ Received characteristic but no value');
        }
      }
    );
    
    console.log('✅ Heart rate monitoring started successfully for:', deviceInfo.device.name);
  }

  /**
   * Parse heart rate data from BLE characteristic
   */
  private parseHeartRateData(value: string, deviceId: string, deviceName?: string): HeartRateReading {
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
      deviceId,
      deviceName,
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
    // Clear readings from all devices
    this.connectedDevices.forEach(deviceInfo => {
      deviceInfo.heartRateReadings = [];
    });
    this.pausedTime = 0;
    this.pauseStartTime = null;
  }

  /**
   * Pause workout
   * @param backdateToTime - Optional timestamp (in ms) to backdate the pause to
   */
  pauseWorkout(backdateToTime?: number): void {
    if (!this.pauseStartTime) {
      this.pauseStartTime = backdateToTime ? new Date(backdateToTime) : new Date();
    }
  }

  /**
   * Resume workout
   */
  resumeWorkout(): void {
    if (this.pauseStartTime) {
      this.pausedTime += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }
  }

  /**
   * Get the timestamp of the last heart rate reading from any device
   */
  getLastHeartRateTime(): Date | null {
    let latestTime: Date | null = null;
    
    this.connectedDevices.forEach(deviceInfo => {
      if (deviceInfo.lastHeartRateTime) {
        if (!latestTime || deviceInfo.lastHeartRateTime > latestTime) {
          latestTime = deviceInfo.lastHeartRateTime;
        }
      }
    });
    
    return latestTime;
  }

  /**
   * Get current workout metrics (aggregated from all devices)
   */
  getWorkoutMetrics(): WorkoutMetrics | null {
    if (!this.workoutStartTime) {
      return null;
    }

    // Aggregate all heart rate readings from all devices
    const allReadings: HeartRateReading[] = [];
    this.connectedDevices.forEach(deviceInfo => {
      allReadings.push(...deviceInfo.heartRateReadings);
    });

    if (allReadings.length === 0) {
      return null;
    }

    // Calculate duration excluding paused time
    let totalElapsed = Date.now() - this.workoutStartTime.getTime();
    let currentPausedTime = this.pausedTime;
    
    // If currently paused, add current pause duration
    if (this.pauseStartTime) {
      currentPausedTime += Date.now() - this.pauseStartTime.getTime();
    }
    
    const duration = Math.floor((totalElapsed - currentPausedTime) / 1000);
    
    // Filter out invalid heart rates (0 or too low)
    const validHeartRates = allReadings
      .map((r: HeartRateReading) => r.heartRate)
      .filter((hr: number) => hr > 0 && hr >= 30); // Ignore 0 and unrealistically low values
    
    if (validHeartRates.length === 0) {
      return null;
    }
    
    const averageHeartRate = Math.round(
      validHeartRates.reduce((sum: number, hr: number) => sum + hr, 0) / validHeartRates.length
    );
    const maxHeartRate = Math.max(...validHeartRates);
    const minHeartRate = Math.min(...validHeartRates);

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
    // If still paused when ending, finalize the pause
    if (this.pauseStartTime) {
      this.pausedTime += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }
    
    const metrics = this.getWorkoutMetrics();
    this.workoutStartTime = null;
    // Clear readings from all devices
    this.connectedDevices.forEach(deviceInfo => {
      deviceInfo.heartRateReadings = [];
    });
    this.pausedTime = 0;
    this.pauseStartTime = null;
    return metrics;
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices(): ConnectedDeviceInfo[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Get a specific connected device by ID
   */
  getConnectedDevice(deviceId: string): ConnectedDeviceInfo | undefined {
    return this.connectedDevices.get(deviceId);
  }

  /**
   * Check if any device is connected
   */
  isConnected(): boolean {
    return this.connectedDevices.size > 0;
  }

  /**
   * Disconnect from a specific device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const deviceInfo = this.connectedDevices.get(deviceId);
    if (deviceInfo) {
      try {
        const manager = this.getManager();
        await manager.cancelDeviceConnection(deviceInfo.device.id);
        this.connectedDevices.delete(deviceId);
        console.log('Disconnected from device:', deviceInfo.device.name);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
  }

  /**
   * Disconnect from all devices
   */
  async disconnect(): Promise<void> {
    const deviceIds = Array.from(this.connectedDevices.keys());
    for (const deviceId of deviceIds) {
      await this.disconnectDevice(deviceId);
    }
    this.listeners.clear();
    console.log('Disconnected from all devices');
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
