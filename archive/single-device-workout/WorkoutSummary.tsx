import React from 'react';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';

interface WorkoutSummaryProps {
  duration: number;
  averageHeartRate: number;
  maxHeartRate: number;
  minHeartRate: number;
  caloriesBurned: number;
  currentZone: number;
}

export const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
  duration,
  averageHeartRate,
  maxHeartRate,
  minHeartRate,
  caloriesBurned,
  currentZone,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Last Workout Summary</Text>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>
          Duration: {Math.floor(duration / 60)} minutes {duration % 60} seconds
        </Text>
        <Text style={styles.summaryText}>Average HR: {averageHeartRate} bpm</Text>
        <Text style={styles.summaryText}>Max HR: {maxHeartRate} bpm</Text>
        <Text style={styles.summaryText}>Min HR: {minHeartRate} bpm</Text>
        <Text style={styles.summaryText}>Calories Burned: {caloriesBurned} kcal</Text>
        <Text style={styles.summaryText}>Peak Zone: Zone {currentZone}</Text>
      </View>
    </View>
  );
};
