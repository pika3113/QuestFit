import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Animated,
  Dimensions 
} from 'react-native';
import { Creature } from '../../src/types/polar';

interface CreatureUnlockModalProps {
  visible: boolean;
  creatures: Creature[];
  onClose: () => void;
}

export const CreatureUnlockModal: React.FC<CreatureUnlockModalProps> = ({
  visible,
  creatures,
  onClose
}) => {
  if (creatures.length === 0) return null;

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
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.congratsText}>🎉 Congratulations! 🎉</Text>
          <Text style={styles.subtitle}>You've unlocked new creatures!</Text>

          <View style={styles.creaturesContainer}>
            {creatures.map((creature, index) => (
              <View 
                key={creature.id} 
                style={[
                  styles.creatureCard,
                  { borderColor: getRarityColor(creature.type) }
                ]}
              >
                <View style={styles.creatureHeader}>
                  <Text style={styles.creatureName}>{creature.name}</Text>
                  <Text 
                    style={[
                      styles.rarityBadge,
                      { backgroundColor: getRarityColor(creature.type) }
                    ]}
                  >
                    {creature.type.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Power</Text>
                    <Text style={styles.statValue}>{creature.stats.power}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Speed</Text>
                    <Text style={styles.statValue}>{creature.stats.speed}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Endurance</Text>
                    <Text style={styles.statValue}>{creature.stats.endurance}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Awesome!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  congratsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  creaturesContainer: {
    width: '100%',
    marginBottom: 24,
  },
  creatureCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  creatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  creatureName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  rarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 150,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
