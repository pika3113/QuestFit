import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';
import { DeviceHeartRateCard } from '@/components/fitness/DeviceHeartRateCard';
import { ConnectedDeviceInfo } from '@/src/services/bluetoothTypes';

const DEVICE_ACCENTS = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#F97316', '#EC4899', '#8B5CF6', '#14B8A6'];

function hashToIndex(input: string, mod: number) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % mod;
}

function accentForDeviceId(deviceId: string) {
  return DEVICE_ACCENTS[hashToIndex(deviceId, DEVICE_ACCENTS.length)];
}

interface ConnectedDevicesListProps {
  connectedDevices: ConnectedDeviceInfo[];
  deviceHeartRates: Map<string, number | null>;
  deviceOwners: Record<string, string>;
  onDisconnect: (deviceId: string, deviceName?: string) => void;
  onDisconnectAll: () => void;
  aggregateHeartRate: number | null;
  currentZone?: number;
}

export const ConnectedDevicesList: React.FC<ConnectedDevicesListProps> = ({
  connectedDevices,
  deviceHeartRates,
  deviceOwners,
  onDisconnect,
  onDisconnectAll,
  aggregateHeartRate: _aggregateHeartRate,
  currentZone: _currentZone,
}) => {
  if (connectedDevices.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.sectionTitle}>
          Connected Devices ({connectedDevices.length})
        </Text>
        {connectedDevices.length > 1 && (
          <Pressable onPress={onDisconnectAll}>
            <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>
              Disconnect All
            </Text>
          </Pressable>
        )}
      </View>
      
      {connectedDevices.map((deviceInfo) => {
        // Try to find owner by device ID or by extracted ID from name
        let ownerName = deviceOwners[deviceInfo.device.id];
        
        if (!ownerName && deviceInfo.device.name) {
          const parts = deviceInfo.device.name.split(' ');
          const lastPart = parts[parts.length - 1];
          if (/^[0-9A-F]{8}$/i.test(lastPart)) {
            ownerName = deviceOwners[lastPart];
          }
        }

        return (
          <DeviceHeartRateCard
            key={deviceInfo.device.id}
            deviceInfo={deviceInfo}
            heartRate={deviceHeartRates.get(deviceInfo.device.id) ?? null}
            onDisconnect={() => onDisconnect(deviceInfo.device.id, deviceInfo.device.name || undefined)}
            compact={connectedDevices.length > 2}
            ownerName={ownerName}
            accentColor={accentForDeviceId(deviceInfo.device.id)}
          />
        );
      })}
    </View>
  );
};

