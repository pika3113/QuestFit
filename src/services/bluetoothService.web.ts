import { BluetoothDevice, HeartRateReading, WorkoutMetrics, ConnectedDeviceInfo, IBluetoothService } from './bluetoothTypes';

class BluetoothServiceWeb implements IBluetoothService {
  private connectedDevices: Map<string, ConnectedDeviceInfo> = new Map();
  private listeners: Map<string, (data: HeartRateReading) => void> = new Map();
  private workoutStartTime: Date | null = null;
  private pausedTime: number = 0;
  private pauseStartTime: Date | null = null;

  initialize(): void {
    // Web Bluetooth doesn't need explicit initialization
  }

  async isBluetoothEnabled(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      return await (navigator as any).bluetooth.getAvailability();
    }
    return false;
  }

  async scanForDevices(onDeviceFound: (device: BluetoothDevice) => void): Promise<void> {
    try {
      // Web Bluetooth requires user gesture and returns a single device selected by user
      // Filtering for Polar Pacer as requested
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'Polar Pacer' }],
        optionalServices: ['heart_rate']
      });

      if (device) {
        const bluetoothDevice: BluetoothDevice = {
          id: device.id,
          name: device.name || 'Unknown Device',
          _nativeDevice: device
        };
        onDeviceFound(bluetoothDevice);
      }
    } catch (error) {
      console.error('Web Bluetooth scan error:', error);
    }
  }

  stopScan(): void {
    // No-op for web
  }

  async connectToDevice(device: BluetoothDevice): Promise<void> {
    try {
      const webDevice = device._nativeDevice;
      if (!webDevice) throw new Error('No web device found');

      if (webDevice.gatt?.connected) {
        console.log('Already connected');
        return;
      }

      const server = await webDevice.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT server');

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');

      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        this.handleHeartRateValueChanged(event, device.id, device.name || undefined);
      });

      this.connectedDevices.set(device.id, {
        device: device,
        currentHeartRate: null,
        lastHeartRateTime: null,
        heartRateReadings: []
      });

    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }

  private handleHeartRateValueChanged(event: any, deviceId: string, deviceName?: string) {
    const value = event.target.value;
    const flags = value.getUint8(0);
    const is16Bit = (flags & 0x01) === 1;
    let heartRate: number;
    let offset = 1;

    if (is16Bit) {
      heartRate = value.getUint16(offset, true); // Little Endian
      offset += 2;
    } else {
      heartRate = value.getUint8(offset);
      offset += 1;
    }

    const reading: HeartRateReading = {
      heartRate,
      timestamp: new Date(),
      deviceId,
      deviceName
    };

    const deviceInfo = this.connectedDevices.get(deviceId);
    if (deviceInfo) {
      deviceInfo.currentHeartRate = heartRate;
      deviceInfo.lastHeartRateTime = new Date();
      deviceInfo.heartRateReadings.push(reading);
    }

    this.listeners.forEach(listener => listener(reading));
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const deviceInfo = this.connectedDevices.get(deviceId);
    if (deviceInfo) {
      const webDevice = deviceInfo.device._nativeDevice;
      if (webDevice.gatt?.connected) {
        webDevice.gatt.disconnect();
      }
      this.connectedDevices.delete(deviceId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const deviceId of this.connectedDevices.keys()) {
      await this.disconnectDevice(deviceId);
    }
    this.listeners.clear();
  }

  getConnectedDevices(): ConnectedDeviceInfo[] {
    return Array.from(this.connectedDevices.values());
  }

  startWorkout(): void {
    this.workoutStartTime = new Date();
    this.connectedDevices.forEach(d => d.heartRateReadings = []);
    this.pausedTime = 0;
    this.pauseStartTime = null;
  }

  pauseWorkout(): void {
    if (!this.pauseStartTime) {
      this.pauseStartTime = new Date();
    }
  }

  resumeWorkout(): void {
    if (this.pauseStartTime) {
      this.pausedTime += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }
  }

  endWorkout(): WorkoutMetrics | null {
    if (this.pauseStartTime) {
      this.pausedTime += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }
    
    const metrics = this.getWorkoutMetrics();
    this.workoutStartTime = null;
    this.connectedDevices.forEach(d => d.heartRateReadings = []);
    this.pausedTime = 0;
    this.pauseStartTime = null;
    return metrics;
  }

  private getWorkoutMetrics(): WorkoutMetrics | null {
    if (!this.workoutStartTime) return null;

    const allReadings: HeartRateReading[] = [];
    this.connectedDevices.forEach(deviceInfo => {
      allReadings.push(...deviceInfo.heartRateReadings);
    });

    if (allReadings.length === 0) return null;

    let totalElapsed = Date.now() - this.workoutStartTime.getTime();
    let currentPausedTime = this.pausedTime;
    if (this.pauseStartTime) {
      currentPausedTime += Date.now() - this.pauseStartTime.getTime();
    }
    
    const duration = Math.floor((totalElapsed - currentPausedTime) / 1000);
    
    const validHeartRates = allReadings
      .map(r => r.heartRate)
      .filter(hr => hr > 0 && hr >= 30);
    
    if (validHeartRates.length === 0) return null;
    
    const averageHeartRate = Math.round(
      validHeartRates.reduce((sum, hr) => sum + hr, 0) / validHeartRates.length
    );
    const maxHeartRate = Math.max(...validHeartRates);
    const minHeartRate = Math.min(...validHeartRates);

    const caloriesBurned = Math.round(averageHeartRate * duration * 0.1 / 60);

    const maxHR = 190; // Default
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

  subscribeToHeartRate(callback: (data: HeartRateReading) => void): () => void {
    const id = Math.random().toString(36).substring(7);
    this.listeners.set(id, callback);
    return () => {
      this.listeners.delete(id);
    };
  }
}

export default new BluetoothServiceWeb();
