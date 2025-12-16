export interface BluetoothDevice {
  id: string;
  name: string | null;
  _nativeDevice?: any; // Store original device object (Device for native, BluetoothDevice for web)
}

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
  device: BluetoothDevice;
  currentHeartRate: number | null;
  lastHeartRateTime: Date | null;
  heartRateReadings: HeartRateReading[];
}

export interface IBluetoothService {
  initialize(): void;
  isBluetoothEnabled(): Promise<boolean>;
  scanForDevices(onDeviceFound: (device: BluetoothDevice) => void): Promise<void>;
  stopScan(): void;
  connectToDevice(device: BluetoothDevice): Promise<void>;
  disconnectDevice(deviceId: string): Promise<void>;
  disconnectAll(): Promise<void>;
  getConnectedDevices(): ConnectedDeviceInfo[];
  startWorkout(): void;
  pauseWorkout(): void;
  resumeWorkout(): void;
  endWorkout(): WorkoutMetrics | null;
  subscribeToHeartRate(callback: (data: HeartRateReading) => void): () => void;
}
