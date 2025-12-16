import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Themed';
import { xpStyles as styles } from '@/src/styles';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

export interface WorkoutHistoryItem {
  sessionId: string;
  date: Date;
  xpEarned: number;
  sport: string;
}

interface WorkoutHistoryProps {
  history: WorkoutHistoryItem[];
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Recent Workouts</Text>
      {history.map((item, index) => (
        <View key={`${item.sessionId}-${index}`} style={styles.historyItem}>
          <View style={styles.historyLeft}>
            <Text style={styles.historyDate}>
              {formatDateDdMmYyyy(item.date)} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.historySport}>{item.sport}</Text>
          </View>
          <View style={styles.historyRight}>
            <Text style={styles.historyXP}>+{item.xpEarned} XP</Text>
          </View>
       </View>
      ))}
    </View>
  );
};
