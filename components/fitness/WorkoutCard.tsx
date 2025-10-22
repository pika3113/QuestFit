import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WorkoutSession } from '../../src/types/polar';

interface WorkoutCardProps {
  session: WorkoutSession;
  onPress?: () => void;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({ session, onPress }) => {
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  sport: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  date: {
    fontSize: 12,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  rewardsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  rewardText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
  },
});
