import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserGameProfile } from '../../src/types/polar';

interface StatsDisplayProps {
  profile: UserGameProfile;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({ profile }) => {
  const experienceToNextLevel = (profile.level * 100) - profile.experience;
  const levelProgress = (profile.experience % 100) / 100;

  // Safe defaults for potentially undefined fields
  const totalWorkouts = profile.totalWorkouts ?? 0;
  const totalCalories = profile.totalCalories ?? 0;
  const totalDistance = profile.totalDistance ?? 0;
  const capturedCreatures = profile.capturedCreatures ?? [];
  const achievements = profile.achievements ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile Stats</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Level {profile.level}</Text>
        </View>
      </View>

      <View style={styles.experienceSection}>
        <View style={styles.experienceHeader}>
          <Text style={styles.experienceText}>Experience: {profile.experience}</Text>
          <Text style={styles.nextLevelText}>{experienceToNextLevel} to next level</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${levelProgress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Calories</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(1)}km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{capturedCreatures.length}</Text>
          <Text style={styles.statLabel}>Creatures</Text>
        </View>
      </View>

      <View style={styles.achievementsSection}>
        <Text style={styles.sectionTitle}>Recent Achievements</Text>
        {achievements.length > 0 ? (
          achievements.slice(-3).map((achievement, index) => (
            <View key={achievement.id} style={styles.achievementItem}>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noAchievements}>No achievements yet. Keep working out!</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  levelBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  experienceSection: {
    marginBottom: 24,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  experienceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  nextLevelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  achievementsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  achievementItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  noAchievements: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});
