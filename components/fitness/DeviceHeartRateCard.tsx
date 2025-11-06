import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ConnectedDeviceInfo } from '@/src/services/bluetoothService';
import Colors from '@/constants/Colors';

interface DeviceHeartRateCardProps {
  deviceInfo: ConnectedDeviceInfo;
  heartRate: number | null;
  onDisconnect: () => void;
  compact?: boolean;
}

export const DeviceHeartRateCard: React.FC<DeviceHeartRateCardProps> = ({
  deviceInfo,
  heartRate,
  onDisconnect,
  compact = false,
}) => {
  const getHeartRateColor = (hr: number | null): string => {
    if (!hr) return '#9CA3AF'; // Gray
    if (hr < 100) return '#60A5FA'; // Light blue
    if (hr < 120) return '#34D399'; // Green
    if (hr < 140) return '#FBBF24'; // Yellow
    if (hr < 160) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactDeviceName} numberOfLines={1}>
            {deviceInfo.device.name || 'Unknown Device'}
          </Text>
          <Pressable onPress={onDisconnect} style={styles.compactDisconnectButton}>
            <Text style={styles.compactDisconnectText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.compactHRContainer}>
          <Text style={[styles.compactHR, { color: getHeartRateColor(heartRate) }]}>
            {heartRate || '--'}
          </Text>
          <Text style={styles.compactBPM}>bpm</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.deviceIcon}>⌚</Text>
          <View>
            <Text style={styles.deviceName}>{deviceInfo.device.name || 'Unknown Device'}</Text>
            <Text style={styles.deviceId}>{deviceInfo.device.id.substring(0, 8)}...</Text>
          </View>
        </View>
        <Pressable onPress={onDisconnect} style={styles.disconnectButton}>
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </Pressable>
      </View>
      
      <View style={styles.hrSection}>
        <View style={styles.hrDisplay}>
          <Text style={[styles.hrValue, { color: getHeartRateColor(heartRate) }]}>
            {heartRate || '--'}
          </Text>
          <Text style={styles.hrUnit}>bpm</Text>
          <Text style={styles.heartIcon}>❤️</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    color: '#94A3B8',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  hrSection: {
    alignItems: 'center',
  },
  hrDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  hrValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginRight: 8,
  },
  hrUnit: {
    fontSize: 18,
    color: '#94A3B8',
    marginRight: 8,
  },
  heartIcon: {
    fontSize: 24,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  
  // Compact styles
  compactCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactDeviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    flex: 1,
  },
  compactDisconnectButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  compactDisconnectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  compactHRContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  compactHR: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 6,
  },
  compactBPM: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
