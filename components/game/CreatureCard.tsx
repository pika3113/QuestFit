import React from 'react';
import { View, Text, Pressable, Modal, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Creature } from '../../src/types/polar';
import {
  creatureCardStyles as styles,
  LEGENDARY_BADGE_GRADIENT_COLORS,
  LEGENDARY_SPECTRUM_GRADIENT_COLORS,
} from '@/src/styles/components/creatureCardStyles';
import { getRarityColor, getSportColor } from '@/src/styles';

const SKELETON_BG = '#F3F4F6';
const SKELETON_FG = '#E5E7EB';

const creatureImages = require.context(
  '../../assets/images/creatures',
  false,
  /^\.\/creature_icon_\d+\.png$/
);

function getCreatureImage(id: string) {
  return creatureImages(`./creature_icon_${id}.png`);
}

interface CreatureCardProps {
  creature: Creature;
  captured?: boolean;
}

export const CreatureCardSkeleton: React.FC = () => {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ height: 14, width: '75%', backgroundColor: SKELETON_FG, borderRadius: 6 }} />
          <View style={{ height: 10, width: 44, backgroundColor: SKELETON_FG, borderRadius: 6, marginTop: 6 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ height: 14, width: 64, backgroundColor: SKELETON_FG, borderRadius: 6, marginLeft: 8 }} />
          <View style={{ height: 22, width: 86, backgroundColor: SKELETON_FG, borderRadius: 12, marginLeft: 8 }} />
        </View>
      </View>

      <View style={{ height: 75, width: '100%', backgroundColor: SKELETON_FG, borderRadius: 10, marginTop: 10, marginBottom: 10 }} />

      <View style={styles.stats}>
        {[0, 1, 2].map((idx) => (
          <View key={idx} style={styles.stat}>
            <View style={{ height: 10, width: 66, backgroundColor: SKELETON_FG, borderRadius: 6, marginBottom: 6 }} />
            <View style={{ height: 14, width: 28, backgroundColor: SKELETON_FG, borderRadius: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

export const CreatureCard: React.FC<CreatureCardProps> = ({ creature, captured = false }) => {

  return (
    <View style={{ width: '100%' }}>
      <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.name}>
              {creature.name}
            </Text>
            <Text style={styles.id}>#{creature.id}</Text>
          </View>
          <View style={styles.header}>
            <Text
              style={[
                styles.sport,
                { color: getSportColor(creature.sport)[0] },
              ]}
            >
              {creature.sport}
            </Text>
            {creature.rarity === 'legendary' ? (
              <LinearGradient
                colors={[...LEGENDARY_BADGE_GRADIENT_COLORS]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.legendaryBadge}
              >
                <Text style={styles.legendaryBadgeText}>{creature.rarity.toUpperCase()}</Text>
              </LinearGradient>
            ) : (
              <Text
                style={[
                  styles.rarityBadge,
                  {
                    backgroundColor: getRarityColor(creature.rarity),
                    color: '#FFFFFF',
                  },
                ]}
              >
                {creature.rarity.toUpperCase()}
              </Text>
            )}
          </View>
        </View>
        <View>
          {captured && (
            <Image 
              source={getCreatureImage(creature.id)}
              style={{ width: '100%', height: 75, resizeMode: 'contain', imageRendering: 'pixelated' } as any} 
            />
          )}
          {!captured && (
            <Image 
              source={getCreatureImage(creature.id)}
              style={{ width: '100%', height: 75, resizeMode: 'contain', imageRendering: 'pixelated', filter: "grayscale(100%)" } as any} 
            />
          )}
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
                <Text style={styles.statLabel}>🛡️ Endurance</Text>
                <Text style={styles.statValue}>{creature.stats.endurance}</Text>
              </View>
            </View>
      </View>
  );
};

interface CardGridProps {
  cards: CreatureCardProps[];
  onPress?: (id: number) => void;
  minCardWidth?: number;
}

export const CreatureCardGrid: React.FC<CardGridProps> = ({
  cards,
  minCardWidth = 300, // minimum size a card can shrink to
  onPress
}: CardGridProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = React.useState(0);
  const effectiveWidth = containerWidth > 0 ? containerWidth : windowWidth;
  const columns = Math.max(Math.floor(effectiveWidth / minCardWidth), 1); // at least 1 column
  const cardWidthPercent = `${100 / columns}%` as `${number}%`;

  const rows: CreatureCardProps[][] = React.useMemo(() => {
    const next: CreatureCardProps[][] = [];
    for (let i = 0; i < cards.length; i += columns) {
      next.push(cards.slice(i, i + columns));
    }
    return next;
  }, [cards, columns]);

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== containerWidth) setContainerWidth(next);
      }}
    >
      {rows.map((row, rowIdx) => (
        <View
          key={`creature-row-${rowIdx}`}
          style={{ flexDirection: 'row', alignItems: 'stretch', width: '100%' }}
        >
          {row.map((card) => (
            <View
              style={{ width: cardWidthPercent, padding: 8, alignSelf: 'stretch' }}
              key={card.creature.id}
            >
              {card.creature.rarity === 'legendary' ? (
                <LinearGradient
                  colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.legendaryCardBorderWrap, { width: '100%', flex: 1 }]}
                >
                  <Pressable
                    style={[styles.card, styles.legendaryCardInner, { flex: 1 }]}
                    onPress={() => onPress?.(parseInt(card.creature.id))}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.legendaryCardBackground}
                    />

                    <CreatureCard creature={card.creature} captured={card.captured} />

                    <View style={styles.border}>
                      <View style={styles.header}>
                        <Text style={styles.desc}>{card.creature.description}</Text>
                        {card.captured && (
                          <View style={styles.capturedBadge}>
                            <Text style={styles.capturedText}>CAPTURED!</Text>
                          </View>
                        )}
                        {!card.captured && (
                          <View style={styles.lockedBadge}>
                            <Text style={styles.capturedText}>LOCKED</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                </LinearGradient>
              ) : (
                <Pressable
                  style={[
                    styles.card,
                    {
                      borderColor: getRarityColor(card.creature.rarity),
                      margin: 0,
                      width: '100%',
                      flex: 1,
                    },
                  ]}
                  onPress={() => onPress?.(parseInt(card.creature.id))}
                >
                  <CreatureCard creature={card.creature} captured={card.captured} />
                  <View style={styles.border}>
                    <View style={styles.header}>
                      <Text style={styles.desc}>{card.creature.description}</Text>
                      {card.captured && (
                        <View style={styles.capturedBadge}>
                          <Text style={styles.capturedText}>CAPTURED!</Text>
                        </View>
                      )}
                      {!card.captured && (
                        <View style={styles.lockedBadge}>
                          <Text style={styles.capturedText}>LOCKED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export const CreatureCardGridSkeleton: React.FC<{ count?: number; minCardWidth?: number }> = ({
  count = 12,
  minCardWidth = 300,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = React.useState(0);
  const effectiveWidth = containerWidth > 0 ? containerWidth : windowWidth;
  const columns = Math.max(Math.floor(effectiveWidth / minCardWidth), 1);
  const cardWidthPercent = `${100 / columns}%` as `${number}%`;

  const rows = React.useMemo(() => {
    const items = Array.from({ length: count });
    const next: number[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      next.push(items.slice(i, i + columns).map((_, idx) => i + idx));
    }
    return next;
  }, [count, columns]);

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== containerWidth) setContainerWidth(next);
      }}
    >
      {rows.map((row, rowIdx) => (
        <View
          key={`creature-skeleton-row-${rowIdx}`}
          style={{ flexDirection: 'row', alignItems: 'stretch', width: '100%' }}
        >
          {row.map((idx) => (
            <View
              style={{ width: cardWidthPercent, padding: 8, alignSelf: 'stretch' }}
              key={`creature-skeleton-${idx}`}
            >
              <View
                style={[
                  styles.card,
                  {
                    borderColor: SKELETON_FG,
                    margin: 0,
                    width: '100%',
                    flex: 1,
                    backgroundColor: SKELETON_BG,
                  },
                ]}
              >
                <CreatureCardSkeleton />
                <View style={styles.border}>
                  <View style={styles.header}>
                    <View style={{ flex: 1, height: 12, backgroundColor: SKELETON_FG, borderRadius: 6, marginBottom: 4 }} />
                    <View style={{ width: 78, height: 18, backgroundColor: SKELETON_FG, borderRadius: 6, marginLeft: 8 }} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

interface CreatureDetailsModalProps {
  visible: boolean;
  creature: Creature;
  captured: boolean;
  onClose: () => void;
}

export const CreatureDetailsModal: React.FC<CreatureDetailsModalProps> = ({
  visible,
  creature,
  captured,
  onClose
}) => {

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {creature.rarity === 'legendary' ? (
          <LinearGradient
            colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.legendaryModalBorderWrap}
          >
            <View style={styles.legendaryModalInner}>
              <LinearGradient
                pointerEvents="none"
                colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.legendaryModalBackground}
              />

              <CreatureCard 
                creature={creature} 
                captured={captured}
              />
              <View style={styles.border}>
                  {captured && (
                    <View style={styles.header}>
                      <Text style={styles.desc}>{creature.lore}</Text>
                      <View style={styles.capturedBadge}>
                        <Text style={styles.capturedText}>CAPTURED!</Text>
                      </View>
                    </View>
                  )}
                  {!captured && (
                    <View>
                      <View style={styles.header}>
                        <Text style={styles.requirementsTitle}>Unlock Requirements:</Text>
                        <View style={styles.lockedBadge}>
                          <Text style={styles.capturedText}>LOCKED</Text>
                        </View>
                      </View>
                        {creature.unlockRequirements.minCalories && (
                          <Text style={styles.requirement}>• {creature.unlockRequirements.minCalories} calories</Text>
                        )}
                        {creature.unlockRequirements.minDistance && (
                          <Text style={styles.requirement}>• {(creature.unlockRequirements.minDistance / 1000).toFixed(1)}km distance</Text>
                        )}
                        {creature.unlockRequirements.minDuration && (
                          <Text style={styles.requirement}>• {creature.unlockRequirements.minDuration} minutes</Text>
                        )}
                        {creature.sport != 'GENERAL' && (
                          <Text style={styles.requirement}>• {creature.sport} workout</Text>
                        )}
                    </View>
                  )}
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.modal, {borderColor: getRarityColor(creature.rarity)}]}>
          <CreatureCard 
            creature={creature} 
            captured={captured}
          />
          <View style={styles.border}>
              {captured && (
                <View style={styles.header}>
                  <Text style={styles.desc}>{creature.lore}</Text>
                  <View style={styles.capturedBadge}>
                    <Text style={styles.capturedText}>CAPTURED!</Text>
                  </View>
                </View>
              )}
              {!captured && (
                <View>
                  <View style={styles.header}>
                    <Text style={styles.requirementsTitle}>Unlock Requirements:</Text>
                    <View style={styles.lockedBadge}>
                      <Text style={styles.capturedText}>LOCKED</Text>
                    </View>
                  </View>
                    {creature.unlockRequirements.minCalories && (
                      <Text style={styles.requirement}>• {creature.unlockRequirements.minCalories} calories</Text>
                    )}
                    {creature.unlockRequirements.minDistance && (
                      <Text style={styles.requirement}>• {(creature.unlockRequirements.minDistance / 1000).toFixed(1)}km distance</Text>
                    )}
                    {creature.unlockRequirements.minDuration && (
                      <Text style={styles.requirement}>• {creature.unlockRequirements.minDuration} minutes</Text>
                    )}
                    {creature.sport != 'GENERAL' && (
                      <Text style={styles.requirement}>• {creature.sport} workout</Text>
                    )}
                </View>
              )}
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
        )}
      </View>
    </Modal>
  );
};

