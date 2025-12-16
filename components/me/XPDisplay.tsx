import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import { xpStyles as styles } from '@/src/styles';

interface XPDisplayProps {
  currentXP: number;
  nextReward: { name: string; xpThreshold: number } | null;
  progress: number;
  onRefresh: () => void;
}

export const XPDisplay: React.FC<XPDisplayProps> = ({
  currentXP,
  nextReward,
  progress,
  onRefresh,
}) => {
  return (
    <View style={styles.xpDisplaySection}>
      <Text style={styles.xpLabel}>Total QuestPoints</Text>
      <View style={styles.xpDisplay}>
        <Text style={styles.xpValue}>{currentXP}</Text>
        <Text style={styles.xpUnit}>QP</Text>
        <Text style={styles.xpIcon}>⭐</Text>
      </View>
      
      {nextReward && (
        <View style={{ width: '100%', marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Next: {nextReward.name}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>{nextReward.xpThreshold - currentXP} QP to go</Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#374151', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ height: '100%', backgroundColor: '#3B82F6', width: `${progress * 100}%` }} />
          </View>
        </View>
      )}

      <Pressable onPress={onRefresh} style={styles.refreshButton}>
        <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
      </Pressable>
    </View>
  );
};
