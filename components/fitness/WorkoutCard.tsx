import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { WorkoutSession } from '../../src/types/polar';
import { workoutCardStyles as styles } from '@/src/styles/components/workoutCardStyles';
import { formatMinutesHms as formatDuration } from '@/src/utils/formatDuration';

interface WorkoutCardProps {
  session: WorkoutSession;
  onPress?: () => void;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({ session, onPress }) => {
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getSportEmoji = (sport: string): string => {
    const sportEmojis: { [key: string]: string } = {
      'RUNNING': '🏃',
      'CYCLING': '🚴',
      'SWIMMING': '🏊',
      'WALKING': '🚶',
      'HIKING': '🥾',
      'FITNESS': '💪',
      'YOGA': '🧘',
      'DEFAULT': '🏋️'
    };
    return sportEmojis[sport.toUpperCase()] || sportEmojis.DEFAULT;
  };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.sportSection}>
          <Text style={styles.sportEmoji}>{getSportEmoji(session.sport)}</Text>
          <Text style={styles.sport}>{session.sport}</Text>
        </View>
        <Text style={styles.date}>{formatDate(session.startTime)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(session.duration)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{session.calories}</Text>
          <Text style={styles.statLabel}>Calories</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(session.distance / 1000).toFixed(1)}km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{session.avgHeartRate}</Text>
          <Text style={styles.statLabel}>Avg HR</Text>
        </View>
      </View>

      <View style={styles.rewardsSection}>
        <View style={styles.rewardItem}>
          <Text style={styles.rewardEmoji}>⭐</Text>
          <Text style={styles.rewardText}>+{session.gameRewards.experienceGained} XP</Text>
        </View>
        
        {session.gameRewards.creaturesFound.length > 0 && (
          <View style={styles.rewardItem}>
            <Text style={styles.rewardEmoji}>🎯</Text>
            <Text style={styles.rewardText}>
              {session.gameRewards.creaturesFound.length} creature{session.gameRewards.creaturesFound.length > 1 ? 's' : ''} found!
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};
