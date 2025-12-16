import React from 'react';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';

interface ActiveWorkoutProps {
  currentHeartRate: number;
  currentZone?: number;
}

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({
  currentHeartRate,
  currentZone,
}) => {
  const getHeartRateZoneColor = (zone: number): string => {
    switch (zone) {
      case 1:
        return '#60A5FA';
      case 2:
        return '#34D399';
      case 3:
        return '#FBBF24';
      case 4:
        return '#F97316';
      case 5:
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  return (
    <View style={styles.heartRateSection}>
      <Text style={styles.heartRateLabel}>Current Heart Rate</Text>
      <View style={styles.heartRateDisplay}>
        <Text style={styles.heartRateValue}>{currentHeartRate || '--'}</Text>
        <Text style={styles.heartRateUnit}>bpm</Text>
        <Text style={styles.heartIcon}>❤️</Text>
      </View>
      {currentZone && (
        <View
          style={[
            styles.zoneIndicator,
            { backgroundColor: getHeartRateZoneColor(currentZone) },
          ]}
        >
          <Text style={styles.zoneText}>Zone {currentZone}</Text>
        </View>
      )}
    </View>
  );
};
