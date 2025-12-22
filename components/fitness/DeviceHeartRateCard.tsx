import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ConnectedDeviceInfo } from '@/src/services/bluetoothTypes';
import Colors from '@/constants/Colors';
import { deviceHeartRateCardStyles as styles } from '@/src/styles/components/deviceHeartRateCardStyles';
import { usePolarHistoricalBaseline, type BaselineRange } from '@/src/hooks/usePolarHistoricalBaseline';

interface DeviceHeartRateCardProps {
  deviceInfo: ConnectedDeviceInfo;
  heartRate: number | null;
  onDisconnect: () => void;
  compact?: boolean;
  ownerName?: string;
  ownerUserId?: string;
  baselineRange?: BaselineRange;
  accentColor?: string;
}

export const DeviceHeartRateCard: React.FC<DeviceHeartRateCardProps> = ({
  deviceInfo,
  heartRate,
  onDisconnect,
  compact = false,
  ownerName,
  ownerUserId,
  baselineRange = '7d',
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

  const normalizedOwnerUserId = (ownerUserId ?? '').trim();
  const { baseline } = usePolarHistoricalBaseline(
    normalizedOwnerUserId,
    baselineRange
  );

  const baselineAvgHr = baseline?.avgExerciseHr ?? null;
  const hrDelta = baselineAvgHr != null && heartRate != null ? heartRate - baselineAvgHr : null;

  const getComparisonDotColor = (): string => {
    if (hrDelta == null) return '#9CA3AF'; // unknown
    const abs = Math.abs(hrDelta);
    if (abs <= 5) return '#34D399'; // close to baseline
    if (hrDelta >= 26) return '#EF4444'; // way above baseline
    if (hrDelta >= 6) return '#FBBF24'; // above baseline
    if (hrDelta <= -26) return '#60A5FA'; // way below baseline
    if (hrDelta <= -6) return '#A855F7'; // below baseline (distinct from blue)
    return '#A855F7';
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
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              marginLeft: 8,
              backgroundColor: getComparisonDotColor(),
              opacity: normalizedOwnerUserId ? 1 : 0.6,
            }}
          />
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
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              marginLeft: 10,
              backgroundColor: getComparisonDotColor(),
              opacity: normalizedOwnerUserId ? 1 : 0.6,
              borderWidth: 1,
              borderColor: '#00000022',
            }}
          />
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
