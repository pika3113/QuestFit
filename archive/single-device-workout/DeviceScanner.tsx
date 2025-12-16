import React from 'react';
import { Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { Device } from 'react-native-ble-plx';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { liveStyles as styles } from '@/src/styles';

interface DeviceScannerProps {
  connectedDevice: Device | null;
  isScanning: boolean;
  bluetoothEnabled: boolean;
  availableDevices: Device[];
  onScan: () => void;
  onConnect: (device: Device) => void;
  onDisconnect: () => void;
}

export const DeviceScanner: React.FC<DeviceScannerProps> = ({
  connectedDevice,
  isScanning,
  bluetoothEnabled,
  availableDevices,
  onScan,
  onConnect,
  onDisconnect,
}) => {
  const colorScheme = useColorScheme();

  const renderDevice = ({ item }: { item: Device }) => (
    <Pressable style={styles.deviceItem} onPress={() => onConnect(item)}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <Text style={styles.connectText}>Connect →</Text>
    </Pressable>
  );

  if (connectedDevice) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Device</Text>
        <View style={styles.connectedBox}>
          <Text style={styles.connectedDeviceName}>
            ✓ {connectedDevice.name || connectedDevice.id}
          </Text>
          <Pressable style={styles.disconnectButton} onPress={onDisconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
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
        onPress={onScan}
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
            Found {availableDevices.length} device
            {availableDevices.length !== 1 ? 's' : ''}
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
  );
};
