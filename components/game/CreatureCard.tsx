import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Creature } from '../../src/types/polar';

interface CreatureCardProps {
  creature: Creature;
  onPress?: () => void;
  captured?: boolean;
}

export const CreatureCard: React.FC<CreatureCardProps> = ({ creature, onPress, captured = false }) => {
  const getRarityColor = (type: Creature['type']) => {
    switch (type) {
      case 'common': return '#9CA3AF';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
      default: return '#9CA3AF';
    }
  };

  return (
    <Pressable 
      style={[styles.container, { borderColor: getRarityColor(creature.type) }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{creature.name}</Text>
        <Text style={[styles.rarity, { color: getRarityColor(creature.type) }]}>
          {creature.type.toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>⚔️ Power</Text>
          <Text style={styles.statValue}>{creature.stats.power}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>⚡ Speed</Text>
          <Text style={styles.statValue}>{creature.stats.speed}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>💪 Endurance</Text>
          <Text style={styles.statValue}>{creature.stats.endurance}</Text>
        </View>
      </View>

      {captured && (
        <View style={styles.capturedBadge}>
          <Text style={styles.capturedText}>CAPTURED</Text>
        </View>
      )}

      <View style={styles.requirements}>
        <Text style={styles.requirementsTitle}>Requirements:</Text>
        {creature.requiredWorkout.minCalories && (
          <Text style={styles.requirement}>• {creature.requiredWorkout.minCalories} calories</Text>
        )}
        {creature.requiredWorkout.minDistance && (
          <Text style={styles.requirement}>• {(creature.requiredWorkout.minDistance / 1000).toFixed(1)}km distance</Text>
        )}
        {creature.requiredWorkout.minDuration && (
          <Text style={styles.requirement}>• {creature.requiredWorkout.minDuration} minutes</Text>
        )}
        {creature.requiredWorkout.sport && (
          <Text style={styles.requirement}>• {creature.requiredWorkout.sport.toLowerCase()} workout</Text>
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
    margin: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  rarity: {
    fontSize: 12,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  capturedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  capturedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  requirements: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
});
