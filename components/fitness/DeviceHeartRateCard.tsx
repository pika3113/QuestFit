import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ConnectedDeviceInfo } from '@/src/services/bluetoothTypes';
import Colors from '@/constants/Colors';
import { deviceHeartRateCardStyles as styles } from '@/src/styles/components/deviceHeartRateCardStyles';

interface DeviceHeartRateCardProps {
  deviceInfo: ConnectedDeviceInfo;
  heartRate: number | null;
  onDisconnect: () => void;
  compact?: boolean;
  ownerName?: string;
  accentColor?: string;
}

export const DeviceHeartRateCard: React.FC<DeviceHeartRateCardProps> = ({
  deviceInfo,
  heartRate,
  onDisconnect,
  compact = false,
  ownerName,
  accentColor,
}) => {
  const getHeartRateColor = (hr: number | null): string => {
    if (hr === null) return '#9CA3AF'; // Gray
    if (hr < 100) return '#60A5FA'; // Light blue
    if (hr < 120) return '#34D399'; // Green
    if (hr < 140) return '#FBBF24'; // Yellow
    if (hr < 160) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };

  if (compact) {
    return (
      <View style={[styles.compactCard, accentColor ? { borderColor: accentColor } : null]}>
        {accentColor ? <View style={[styles.accentStripCompact, { backgroundColor: accentColor }]} /> : null}
        <View style={styles.compactHeader}>
          <Text style={styles.compactDeviceName} numberOfLines={1}>
            {ownerName || deviceInfo.device.name || 'Unknown Device'}
          </Text>
          <Pressable onPress={onDisconnect} style={styles.compactDisconnectButton}>
            <Text style={styles.compactDisconnectText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.compactHRContainer}>
          <Text style={[styles.compactHR, { color: getHeartRateColor(heartRate) }]}>
            {heartRate ?? '--'}
          </Text>
          <Text style={styles.compactBPM}>bpm</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, accentColor ? { borderColor: accentColor } : null]}>
      {accentColor ? <View style={[styles.accentStrip, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={styles.deviceName}>
              {ownerName || deviceInfo.device.name || 'Unknown Device'}
            </Text>
            <Text style={styles.deviceId}>
              {ownerName ? deviceInfo.device.name : deviceInfo.device.id.substring(0, 8) + '...'}
            </Text>
          </View>
        </View>
        <Pressable onPress={onDisconnect} style={styles.disconnectButton}>
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </Pressable>
      </View>
      
      <View style={styles.hrSection}>
        <View style={styles.hrDisplay}>
          <Text style={[styles.hrValue, { color: getHeartRateColor(heartRate) }]}>
            {heartRate ?? '--'}
          </Text>
          <Text style={styles.hrUnit}>bpm</Text>
        </View>
        
        {deviceInfo.lastHeartRateTime && (
          <Text style={styles.lastUpdate}>
            Last update: {new Date(deviceInfo.lastHeartRateTime).toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
};
