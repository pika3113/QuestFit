import React from 'react';
import { Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { liveStyles as styles } from '@/src/styles';
import { ConnectedDeviceInfo, BluetoothDevice } from '@/src/services/bluetoothTypes';

interface MultiDeviceScannerProps {
  isScanning: boolean;
  bluetoothEnabled: boolean;
  availableDevices: BluetoothDevice[];
  connectedDevices: ConnectedDeviceInfo[];
  deviceOwners: Record<string, string>;
  onScan: () => void;
  onConnect: (device: BluetoothDevice) => void;
}

export const MultiDeviceScanner: React.FC<MultiDeviceScannerProps> = ({
  isScanning,
  bluetoothEnabled,
  availableDevices,
  connectedDevices,
  deviceOwners,
  onScan,
  onConnect,
}) => {
  const colorScheme = useColorScheme();

  const renderDevice = ({ item }: { item: BluetoothDevice }) => {
    const isConnected = connectedDevices.some(d => d.device.id === item.id);
    const ownerName = deviceOwners[item.id];

    return (
      <Pressable
        style={[styles.deviceItem, isConnected && styles.deviceItemConnected]}
        onPress={() => !isConnected && onConnect(item)}
        disabled={isConnected}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {item.name || 'Unknown Device'}
            {ownerName ? ` (${ownerName})` : ''}
          </Text>
          <Text style={styles.deviceId}>{item.id}</Text>
        </View>
        <Text style={styles.connectText}>
          {isConnected ? 'Connected ✓' : 'Connect →'}
        </Text>
      </Pressable>
    );
  };


  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Connect Devices</Text>
      
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
  );
};
