import { View, Text } from '@/components/Themed';
import { battleStyles as styles, getRarityColor, getSportColor, LEGENDARY_BADGE_GRADIENT_COLORS } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { Creature } from '@/src/types/polar';
import {  } from '@/src/styles';
import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const creatureImages = require.context(
  '../../assets/images/creatures',
  false,
  /^\.\/creature_icon_\d+\.png$/
);

const typeMatchups = [[1, 1, 1, 1, 1, 1, 1], // GENERAL
                      [1, 1, 0.5, 2, 2, 0.5, 0.5], // RUNNING
                      [1, 2, 1, 0.5, 1, 1, 2], // SWIMMING
                      [1, 0.5, 2, 0.5, 0.5, 2, 1], // HIKING
                      [1, 0.5, 1, 2, 2, 2, 1], // FITNESS
                      [1, 2, 2, 0.5, 1, 1, 1], // CYCLING
                      [1, 0.5, 1, 1, 2, 1, 1] // CIRCUIT
                    ];

function getCreatureImage(id: string) {
  return creatureImages(`./creature_icon_${id}.png`);
}

interface IconProps {
  creature: Creature;
  attackTrigger?: (trigger: () => void) => void
  onFaintEnd?: () => void;
};

function IdleIcon({ creature, attackTrigger }: IconProps) {
  const delay = 800/(1+Math.exp(0.03*(creature.stats.speed-50)))+100;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const idleAnim = useRef(new Animated.Value(0)).current;
  const attackAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    entranceAnim.setValue(0);
    idleAnim.setValue(0);
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Start idle animation after entrance
      Animated.loop(
        Animated.sequence([
          Animated.timing(idleAnim, {
            toValue: -10,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(delay),
          Animated.timing(idleAnim, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(delay)
        ])
      ).start();
    });
  }, [creature.id]);

  // Scale interpolation for entrance
  const scale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], 
  });

   // Attack animation trigger
  const triggerAttack = () => {
    Animated.sequence([
      Animated.timing(attackAnim, {
        toValue: -50,
        duration: delay/2,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(delay),
      Animated.timing(attackAnim, {
        toValue: 0,
        duration: delay/2,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    attackTrigger?.(triggerAttack);
  }, [attackTrigger]);

  // Transform stack to anchor to bottom
  const transform = [
    { translateY: 75 },
    { scale },
    { translateY: Animated.add(-75, idleAnim) }, // combine entrance + idle
    { translateX: attackAnim } // attack
  ];

  return (
    <Animated.Image
      source={getCreatureImage(creature.id)}
      style={[
        styles.creatureIcon,
        {
          width: 150,
          height: 150,
          transform,
        },
      ]}
      resizeMode="contain"
    />
  );
}

function FaintedIcon ({ creature, onFaintEnd }: IconProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onFaintEnd?.();
      }
    });
  }, []);

  const scaleY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  const colorOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const greyOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={{
        transform: [ 
          { translateY: 75 },
          { scaleY },
          { translateY: -75 } ]
      }}
    >
      <Animated.Image
        source={getCreatureImage(creature.id)}
        style={[
          styles.creatureIcon,
          {
          width: 150,
          height: 150,
          opacity: colorOpacity
          }
        ]}
        resizeMode="contain"
      />
      <Animated.Image
        source={getCreatureImage(creature.id)}
        style={[
          styles.creatureIcon,
          {
          width: 150,
          height: 150,
          opacity: greyOpacity,
          ...StyleSheet.absoluteFillObject,
          filter: "grayscale(40%)"
          }
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

interface SpecialProps {
  max: number;
  current: number;
  sport: "GENERAL" | "RUNNING" | "SWIMMING" | "HIKING" | "FITNESS" | "CYCLING" | "CIRCUIT";
};

function SpecialIcon() {
  return (
    <>
      <Path d="M49.126,150.126c0-42.346,26.212-78.68,63.26-93.643l18.904-37.971C66.847,27.667,17.126,83.194,17.126,150.126c0,60.895,41.157,112.355,97.113,128.035l3.636-32.354C77.952,232.337,49.126,194.535,49.126,150.126z" />
      <Path d="M283.019,150.126c0-60.883-41.139-112.333-97.076-128.025l-3.718,32.33c39.946,13.457,68.794,51.27,68.794,95.695c0,42.099-25.907,78.255-62.613,93.379l-19.428,38.217C233.361,272.515,283.019,217.015,283.019,150.126z" />
      <Path d="M226.169,134.015c1.26-2.479,1.141-5.202-0.314-7.572c-1.454-2.371-4.036-3.316-6.818-3.316h-60.821L171.309,9.3c0.446-3.859-1.946-7.857-5.672-8.963C164.868,0.109,164.089,0,163.32,0c-2.954,0-5.746,1.681-7.121,4.442L73.946,169.718c-1.234,2.479-1.098,5.78,0.36,8.136c1.459,2.355,4.031,4.273,6.802,4.273h60.019l-12.304,109.543c-0.43,3.844,1.951,7.077,5.657,8.185c0.761,0.228,1.532,0.29,2.293,0.29c2.948,0,5.74-1.637,7.133-4.378L226.169,134.015z" />
    </>
  );
}

function SpecialSvg({ max, current, sport }: SpecialProps) {

  const progress = Math.min(current/max, 1);

  return (
    <Svg height='100%' viewBox="0 0 300.145 300.145">
      <Defs>
        <ClipPath id="progressClip">
          {/* Bottom → Top reveal */}
          <Rect
            x="0"
            y={300.145 * (1 - progress)}
            width="300.145"
            height={300.145 * progress}
          />
        </ClipPath>
      </Defs>

      <G clipPath="url(#progressClip)" fill={getSportColor(sport)[0]}>
        <SpecialIcon />
      </G>
    </Svg>
  );
}

interface HealthBarProps {
  health: number;
  maxHealth: number;
};

function HealthBar ({ health, maxHealth }: HealthBarProps) {
  return (
    <View style={styles.healthBarContainer}>
      <View style={styles.emptyHealthBar}>
        <View style={[styles.healthBar, {width: `${health/maxHealth*100}%`}]}/>
      </View>
    </View>
  );
}

function calcDamage(attacker: Creature, defender: Creature): number {
  const typeDict = {'GENERAL': 0, 'RUNNING': 1, 'SWIMMING': 2, 'HIKING': 3, 'FITNESS': 4, 'CYCLING': 5, 'CIRCUIT': 6};
  return Math.floor((attacker.stats.power/defender.stats.endurance*4+1)*typeMatchups[typeDict[attacker.sport]][typeDict[defender.sport]]);
}

function calcClicks(creature: Creature): number {
  return 1000/(creature.stats.speed+9);
}

function calcChargeMax(creature: Creature): number {
  return Math.ceil((creature.stats.power**2*creature.stats.endurance/(100*creature.stats.speed))**(2/5));
}

export default function BattleScreen() {

  const user = 'PlaceholderUser'; // Placeholder for user
  const opponent = 'PlaceholderOpponent'; // Placeholder for opponent

  const allCreatures = creatureService.getAllCreatures(); // This is just for the placeholders lol

  const creatures = [allCreatures[0], allCreatures[3], allCreatures[5], allCreatures[6], allCreatures[21], allCreatures[22]]; // Placeholder for creatures, first 3 is user, last 3 is opponent
  const clicks = [calcClicks(creatures[0]), calcClicks(creatures[1]), calcClicks(creatures[2]), calcClicks(creatures[3]), calcClicks(creatures[4]), calcClicks(creatures[5])];
  const [clickNum, setClickNum] = useState(0);
  const [healths, setHealths] = useState<number[]>(
    creatures.map(c => c.stats.endurance)
  );
  const [charges, setCharges] = useState<number[]>(
    Array(creatures.length).fill(0)
  );
  const chargeMaxes = [calcChargeMax(creatures[0]), calcChargeMax(creatures[1]), calcChargeMax(creatures[2]), calcChargeMax(creatures[3]), calcChargeMax(creatures[4]), calcChargeMax(creatures[5])];

  const [userSelectedCreature, setUserSelectedCreature] = useState<0 | 1 | 2>(0);
  const [opponentSelectedCreature, setOpponentSelectedCreature] = useState<3 | 4 | 5>(3);

  const [canSwitch, setCanSwitch] = useState(true);
  const cooldownAnim = useRef(new Animated.Value(0)).current;

  const attackRefs = useRef<{ [key: string]: () => void }>({});
  const onCreatureAttack = (creatureId: string) => {
    attackRefs.current[creatureId]?.();
  };

  const battlePress = () => {

    if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;

    setClickNum(prev => prev + 1);
    if (clickNum < clicks[userSelectedCreature]) return;

    onCreatureAttack(creatures[userSelectedCreature].id);

    setHealths(prev => {
      const next = [...prev];
      next[opponentSelectedCreature] = Math.max(next[opponentSelectedCreature]-calcDamage(creatures[userSelectedCreature], creatures[opponentSelectedCreature]), 0);
      return next;
    });

    setCharges(prev => {
      const next = [...prev];
      next[userSelectedCreature] += 1;
      return next;
    });

    setClickNum(0);
  };

  const specialPress = () => {

    if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;
    if (charges[userSelectedCreature] < chargeMaxes[userSelectedCreature]) return;

    onCreatureAttack(creatures[userSelectedCreature].id);

    setHealths(prev => {
      const next = [...prev];
      next[opponentSelectedCreature] = Math.max(next[opponentSelectedCreature]-calcDamage(creatures[userSelectedCreature], creatures[opponentSelectedCreature])*5, 0);
      return next;
    });

    setCharges(prev => {
      const next = [...prev];
      next[userSelectedCreature] = 0;
      return next;
    });
  };

  const switchCreature = (index: 0 | 1 | 2) => {
    if (!canSwitch) return;
    if (userSelectedCreature === index) return;

    setUserSelectedCreature(index);
    setClickNum(0);

    setCanSwitch(false);
    cooldownAnim.setValue(1);

    Animated.timing(cooldownAnim, {
      toValue: 0,
      duration: 10000, // 10 seconds cooldown
      easing: Easing.linear,
      useNativeDriver: false, // height animation
    }).start(() => {
      setCanSwitch(true);
    });
  };

  const fillHeight = cooldownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  function getNextAliveOpponent(
    healths: number[],
    start: 3 | 4 | 5
  ): 3 | 4 | 5 | null {
    for (let i = start; i <= 5; i++) {
      if (healths[i] > 0) return i as 3 | 4 | 5;
    }
    return null;
  }

  const handleOpponentFaintEnd = () => {
    setTimeout(() => {
      const next = getNextAliveOpponent(
        healths,
        (opponentSelectedCreature + 1) as 3 | 4 | 5
      );

      if (next !== null) {
        setOpponentSelectedCreature(next);
      }
    }, 2500);
  };

  useEffect(() => { // opponent attacks
    const interval = setInterval(() => {

      if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;

      onCreatureAttack(creatures[opponentSelectedCreature].id);
      
      if (charges[opponentSelectedCreature] < chargeMaxes[opponentSelectedCreature]) {
        setHealths(prev => {
          const next = [...prev];
          next[userSelectedCreature] = Math.max(next[userSelectedCreature]-calcDamage(creatures[opponentSelectedCreature], creatures[userSelectedCreature]), 0);
          return next;
        });

        setCharges(prev => {
          const next = [...prev];
          next[opponentSelectedCreature] += 1;
          return next;
        });
      } else {
        setHealths(prev => {
          const next = [...prev];
          next[userSelectedCreature] = Math.max(next[userSelectedCreature]-calcDamage(creatures[opponentSelectedCreature], creatures[userSelectedCreature])*5, 0);
          return next;
        });

        setCharges(prev => {
          const next = [...prev];
          next[opponentSelectedCreature] = 0;
          return next;
        });
      }
    }, clicks[opponentSelectedCreature]*200);

    return () => clearInterval(interval);
  }, [opponentSelectedCreature, userSelectedCreature, healths]);

  useEffect(() => { // if user creature faints
    if (healths[userSelectedCreature] > 0) return;

    cooldownAnim.stopAnimation();
    cooldownAnim.setValue(0);
    setCanSwitch(true);
  }, [healths[userSelectedCreature]]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.username, {color: '#3B82F6'}]}>{user}</Text>
        <Text style={[styles.username, {color: '#EF4444'}]}>{opponent}</Text>
      </View>
      <View style={[styles.header, {borderBottomWidth: 1, borderBottomColor: '#E5E7EB'}]}>
        <View style={styles.creatureHeader}>
          <Pressable
            disabled={!canSwitch || healths[0] <= 0}
            onPress={() => switchCreature(0)}
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[0] > 0 ? '#3B82F6' : '#6B7280' },
              healths[0] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.cooldownFill,
                {
                  height: fillHeight,
                },
              ]}
            />
            <Image
              source={getCreatureImage(creatures[0].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: canSwitch && healths[0] > 0 ? 1 : 0.4,
                  tintColor: healths[0] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </Pressable>
          <Pressable
            disabled={!canSwitch || healths[1] <= 0}
            onPress={() => switchCreature(1)}
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[1] > 0 ? '#3B82F6' : '#6B7280' },
              healths[1] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.cooldownFill,
                {
                  height: fillHeight,
                },
              ]}
            />
            <Image
              source={getCreatureImage(creatures[1].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: canSwitch && healths[1] > 0 ? 1 : 0.4,
                  tintColor: healths[1] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </Pressable>
          <Pressable
            disabled={!canSwitch || healths[2] <= 0}
            onPress={() => switchCreature(2)}
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[2] > 0 ? '#3B82F6' : '#6B7280' },
              healths[2] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.cooldownFill,
                {
                  height: fillHeight,
                },
              ]}
            />
            <Image
              source={getCreatureImage(creatures[2].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: canSwitch && healths[2] > 0 ? 1 : 0.4,
                  tintColor: healths[2] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </Pressable>
        </View>
        <View style={styles.creatureHeader}>
          <View
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[3] > 0 ? '#EF4444' : '#6B7280' },
              healths[3] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Image
              source={getCreatureImage(creatures[3].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: healths[3] > 0 ? 1 : 0.4,
                  tintColor: healths[3] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[4] > 0 ? '#EF4444' : '#6B7280' },
              healths[4] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Image
              source={getCreatureImage(creatures[4].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: healths[4] > 0 ? 1 : 0.4,
                  tintColor: healths[4] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.creatureIconContainer,
              { borderColor: healths[5] > 0 ? '#EF4444' : '#6B7280' },
              healths[5] <= 0 && { opacity: 0.4 }
            ]}
          >
            <Image
              source={getCreatureImage(creatures[5].id)}
              style={[
                styles.creatureIcon,
                {
                  opacity: healths[5] > 0 ? 1 : 0.4,
                  tintColor: healths[5] <= 0 ? '#6B7280' : undefined,
                },
              ]}
            />
          </View>
        </View>
      </View>
      <Pressable style={{flex: 1}} onPress={() => { battlePress(); }}>
        <View style={styles.battleArea}> 
          <View style={[styles.creature, {transform: [ {scaleX: -1} ]}]}>
            <View style={[styles.creatureStats, {transform: [ {scaleX: -1} ], marginTop: 12}]}>
              <Text style={styles.creatureName}>
                {creatures[userSelectedCreature].name}  <Text style={styles.creatureStat}>
                  ⚔️ {creatures[userSelectedCreature].stats.power} ⚡ {creatures[userSelectedCreature].stats.speed} 🛡️ {creatures[userSelectedCreature].stats.endurance}
                </Text>
              </Text>
            </View>
            <View style={[styles.creatureStats, {transform: [ {scaleX: -1} ], marginTop: 4}]}>
              <Text style={[styles.creatureSport, { 
                color: getSportColor(creatures[userSelectedCreature].sport)[0] }]}>
                {creatures[userSelectedCreature].sport}
              </Text>
              {creatures[userSelectedCreature].rarity === 'legendary' ? (
                            <LinearGradient
                              colors={[...LEGENDARY_BADGE_GRADIENT_COLORS]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.creatureRarityBadge}
                            >
                              <Text style={styles.legendaryBadgeText}>{creatures[userSelectedCreature].rarity.toUpperCase()}</Text>
                            </LinearGradient>
                          ) : (
                            <Text
                              style={[
                                styles.creatureRarityBadge,
                                {
                                  backgroundColor: getRarityColor(creatures[userSelectedCreature].rarity),
                                  color: '#FFFFFF',
                                },
                              ]}
                            >
                              {creatures[userSelectedCreature].rarity.toUpperCase()}
                            </Text>
                          )}
            </View>
            <HealthBar 
              health={healths[userSelectedCreature]} 
              maxHealth={creatures[userSelectedCreature].stats.endurance} 
            />
            {healths[userSelectedCreature] == 0 ? (
              <FaintedIcon creature={creatures[userSelectedCreature]} />
            ) : (
              <IdleIcon 
                creature={creatures[userSelectedCreature]}
                attackTrigger={(trigger) => (attackRefs.current[creatures[userSelectedCreature].id] = trigger)}
              />
            )}
          </View>
          <View style={styles.creature}>
            <View style={[styles.creatureStats, {justifyContent: 'flex-end', marginTop: 12}]}>
              <Text style={styles.creatureName}>
                {creatures[opponentSelectedCreature].name}  <Text style={styles.creatureStat}>
                  ⚔️ {creatures[opponentSelectedCreature].stats.power} ⚡ {creatures[opponentSelectedCreature].stats.speed} 🛡️ {creatures[opponentSelectedCreature].stats.endurance}
                </Text>
              </Text>
            </View>
            <View style={[styles.creatureStats, {justifyContent: 'flex-end', marginTop: 4}]}>
              <Text style={[styles.creatureSport, { 
                color: getSportColor(creatures[opponentSelectedCreature].sport)[0] }]}>
                {creatures[opponentSelectedCreature].sport}
              </Text>
              {creatures[opponentSelectedCreature].rarity === 'legendary' ? (
                            <LinearGradient
                              colors={[...LEGENDARY_BADGE_GRADIENT_COLORS]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.creatureRarityBadge}
                            >
                              <Text style={styles.legendaryBadgeText}>{creatures[opponentSelectedCreature].rarity.toUpperCase()}</Text>
                            </LinearGradient>
                          ) : (
                            <Text
                              style={[
                                styles.creatureRarityBadge,
                                {
                                  backgroundColor: getRarityColor(creatures[opponentSelectedCreature].rarity),
                                  color: '#FFFFFF',
                                },
                              ]}
                            >
                              {creatures[opponentSelectedCreature].rarity.toUpperCase()}
                            </Text>
                          )}
            </View>
            <HealthBar 
              health={healths[opponentSelectedCreature]} 
              maxHealth={creatures[opponentSelectedCreature].stats.endurance} 
            />
            {healths[opponentSelectedCreature] == 0 ? (
              <FaintedIcon creature={creatures[opponentSelectedCreature]} onFaintEnd={handleOpponentFaintEnd} />
            ) : (
              <IdleIcon 
                creature={creatures[opponentSelectedCreature]}
                attackTrigger={(trigger) => (attackRefs.current[creatures[opponentSelectedCreature].id] = trigger)}
              />
            )}
          </View>
        </View>
          <View style={styles.specialContainer}>
            <Pressable
              onPress={specialPress}
              hitSlop={10}
              disabled={charges[userSelectedCreature] < chargeMaxes[userSelectedCreature]}
              style={({ pressed }) => [
                styles.specialButton,
                pressed && { opacity: 0.6 },
                charges[userSelectedCreature] < chargeMaxes[userSelectedCreature] && { opacity: 0.4 },
              ]}
            >
              <SpecialSvg
                max={chargeMaxes[userSelectedCreature]}
                current={charges[userSelectedCreature]}
                sport={creatures[userSelectedCreature].sport}
              />
            </Pressable>
          </View>
      </Pressable>
    </View>
  );
}
