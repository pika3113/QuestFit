import { View, Text } from '@/components/Themed';
import { battleStyles as styles, getRarityColor, getSportColor } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { Creature } from '@/src/types/polar';
import {  } from '@/src/styles';
import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';

const creatureImages = require.context(
  '../../assets/images/creatures',
  false,
  /^\.\/creature_icon_\d+\.png$/
);

const typeMatchups = [[1, 1, 1, 1, 1, 1, 1], // NEUTRAL
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
};

function IdleIcon ({ creature }: IconProps) {

  const translateY = useRef(new Animated.Value(0)).current;
  const delay = 800/(1+Math.exp(0.03*(creature.stats.speed-50)))+100;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(delay),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(delay)
      ])
    ).start();
  }, []);

  return (
    <Animated.Image
      source={getCreatureImage(creature.id)}
      style={[
        styles.creatureIcon,
        {
        width: 150,
        height: 150,
        transform: [ {translateY} ],
        }
      ]}
      resizeMode="contain"
    />
  );
}

interface SpecialProps {
  max: number;
  current: number;
  sport: "NEUTRAL" | "RUNNING" | "SWIMMING" | "HIKING" | "FITNESS" | "CYCLING" | "CIRCUIT";
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
  const typeDict = {'NEUTRAL': 0, 'RUNNING': 1, 'SWIMMING': 2, 'HIKING': 3, 'FITNESS': 4, 'CYCLING': 5, 'CIRCUIT': 6};
  return Math.floor((attacker.stats.power/defender.stats.endurance*4+1)*typeMatchups[typeDict[attacker.sport]][typeDict[defender.sport]]);
}

function calcDelay(creature: Creature): number {
  return 100000/(creature.stats.speed+9);
}

function calcChargeMax(creature: Creature): number {
  return Math.ceil((creature.stats.power**2*creature.stats.endurance/(100*creature.stats.speed))**(1/3));
}

export default function BattleScreen() {

  const user = 'PlaceholderUser'; // Placeholder for user
  const opponent = 'PlaceholderOpponent'; // Placeholder for opponent

  const allCreatures = creatureService.getAllCreatures(); // This is just for the placeholders lol

  const creatures = [allCreatures[0], allCreatures[3], allCreatures[5], allCreatures[6], allCreatures[21], allCreatures[22]]; // Placeholder for creatures, first 3 is user, last 3 is opponent
  const delays = [calcDelay(creatures[0]), calcDelay(creatures[1]), calcDelay(creatures[2]), calcDelay(creatures[3]), calcDelay(creatures[4]), calcDelay(creatures[5])];
  const [healths, setHealths] = useState<number[]>(
    creatures.map(c => c.stats.endurance)
  );
  const [charges, setCharges] = useState<number[]>(
    Array(creatures.length).fill(0)
  );
  const chargeMaxes = [calcChargeMax(creatures[0]), calcChargeMax(creatures[1]), calcChargeMax(creatures[2]), calcChargeMax(creatures[3]), calcChargeMax(creatures[4]), calcChargeMax(creatures[5])];

  const [userSelectedCreature, setUserSelectedCreature] = useState<0 | 1 | 2>(0);
  const [opponentSelectedCreature, setOpponentSelectedCreature] = useState<3 | 4 | 5>(3);

  const isLocked = useRef(false);
  const battlePress = (delay: number) => {
    if (isLocked.current) return;

    isLocked.current = true;

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

    setTimeout(() => {
      isLocked.current = false;
    }, delay);
  };

  const specialPress = () => {
    if (charges[userSelectedCreature] < chargeMaxes[userSelectedCreature]) return;

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.username, {color: '#3B82F6'}]}>{user}</Text>
        <Text style={[styles.username, {color: '#EF4444'}]}>{opponent}</Text>
      </View>
      <View style={[styles.header, {borderBottomWidth: 1, borderBottomColor: '#E5E7EB'}]}>
        <View style={styles.creatureHeader}>
          <View style={[styles.creatureIconContainer, {borderColor: '#3B82F6'}]}>
            <Image 
              source={getCreatureImage(creatures[0].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#3B82F6'}]}>
            <Image 
              source={getCreatureImage(creatures[1].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#3B82F6'}]}>
            <Image 
              source={getCreatureImage(creatures[2].id)}
              style={styles.creatureIcon} 
            />
          </View>
        </View>
        <View style={styles.creatureHeader}>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(creatures[3].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(creatures[4].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(creatures[5].id)}
              style={styles.creatureIcon} 
            />
          </View>
        </View>
      </View>
      <Pressable style={{flex: 1}} onPress={() => { battlePress(delays[userSelectedCreature]); }}>
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
              <Text style={[styles.creatureRarity, { color: getRarityColor(creatures[userSelectedCreature].rarity) }]}>
                {creatures[userSelectedCreature].rarity.toUpperCase()}
              </Text>
              <Text style={[styles.creatureSportBadge, { 
                backgroundColor: getSportColor(creatures[userSelectedCreature].sport)[0],
                color: getSportColor(creatures[userSelectedCreature].sport)[1] }]}>
                {creatures[userSelectedCreature].sport}
              </Text>
            </View>
            <HealthBar 
              health={healths[userSelectedCreature]} 
              maxHealth={creatures[userSelectedCreature].stats.endurance} 
            />
            <IdleIcon 
                creature={creatures[userSelectedCreature]}
            /> 
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
              <Text style={[styles.creatureRarity, { color: getRarityColor(creatures[opponentSelectedCreature].rarity) }]}>
                {creatures[opponentSelectedCreature].rarity.toUpperCase()}
              </Text>
              <Text style={[styles.creatureSportBadge, { 
                backgroundColor: getSportColor(creatures[opponentSelectedCreature].sport)[0],
                color: getSportColor(creatures[opponentSelectedCreature].sport)[1] }]}>
                {creatures[opponentSelectedCreature].sport}
              </Text>
            </View>
            <HealthBar 
              health={healths[opponentSelectedCreature]} 
              maxHealth={creatures[opponentSelectedCreature].stats.endurance} 
            />
            <IdleIcon 
                creature={creatures[opponentSelectedCreature]}
            /> 
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
