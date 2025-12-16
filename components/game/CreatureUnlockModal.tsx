import React from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Creature } from '../../src/types/polar';
import { creatureUnlockModalStyles as styles } from '@/src/styles/components/creatureUnlockModalStyles';
import { getRarityColor, getSportColor } from '@/src/styles';

const creatureImages = require.context(
  '../../assets/images/creatures',
  false,
  /^\.\/creature_icon_\d+\.png$/
);

function getCreatureImage(id: string) {
  return creatureImages(`./creature_icon_${id}.png`);
}

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

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.congratsText}>🎉 Congratulations! 🎉</Text>
            <Text style={styles.subtitle}>You've unlocked {creatures.length} new creatures!</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.creaturesContainer}>
              {creatures.map((creature) => (
                <View
                  key={creature.id}
                  style={[styles.creatureCard, { borderColor: getRarityColor(creature.rarity) }]}
                >
                  <Image
                    source={getCreatureImage(creature.id)}
                    style={styles.creatureImage as any}
                    contentFit="contain"
                  />

                  <View style={styles.creatureHeader}>
                    <Text style={styles.creatureName}>{creature.name}</Text>
                    <View style={[styles.creatureHeader, { marginBottom: 0 }]}>
                      <Text style={[styles.rarity, { color: getRarityColor(creature.rarity) }]}>
                        {creature.rarity.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.sportBadge,
                          {
                            backgroundColor: getSportColor(creature.sport)[0],
                            color: getSportColor(creature.sport)[1],
                          },
                        ]}
                      >
                        {creature.sport}
                      </Text>
                    </View>
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
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Awesome!</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
