import { View, Text } from '@/components/Themed';
import { battleStyles as styles } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Creature } from '@/src/types/polar';
import { getRarityColor, getSportColor } from '@/src/styles';
import SpecialIcon from '../../assets/images/special.svg'

const creatureImages = require.context(
  '../../assets/images/creatures',
  false,
  /^\.\/creature_icon_\d+\.png$/
);

function getCreatureImage(id: string) {
  return creatureImages(`./creature_icon_${id}.png`);
}

type IconProps = {
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

export default function BattleScreen() {

  const user = 'PlaceholderUser'; // Placeholder for user
  const opponent = 'PlaceholderOpponent'; // Placeholder for opponent

  const allCreatures = creatureService.getAllCreatures(); // This is just for the placeholders lol
  const userCreatures = [allCreatures[0], allCreatures[3], allCreatures[5]]; // Placeholder for user's creatures
  const opponentCreatures = [allCreatures[6], allCreatures[21], allCreatures[22]]; // Placeholder for opponent's creatures

  const userSelectedCreature = 2; // Placeholder user selected index
  const opponentSelectedCreature = 2; // Placeholder opponent selected index

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
              source={getCreatureImage(userCreatures[0].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#3B82F6'}]}>
            <Image 
              source={getCreatureImage(userCreatures[1].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#3B82F6'}]}>
            <Image 
              source={getCreatureImage(userCreatures[2].id)}
              style={styles.creatureIcon} 
            />
          </View>
        </View>
        <View style={styles.creatureHeader}>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(opponentCreatures[0].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(opponentCreatures[1].id)}
              style={styles.creatureIcon} 
            />
          </View>
          <View style={[styles.creatureIconContainer, {borderColor: '#EF4444'}]}>
            <Image 
              source={getCreatureImage(opponentCreatures[2].id)}
              style={styles.creatureIcon} 
            />
          </View>
        </View>
      </View>
      <View style={styles.battleArea}> 
        <View style={[styles.creature, {transform: [ {scaleX: -1} ]}]}>
          <View style={[styles.creatureStats, {transform: [ {scaleX: -1} ], marginTop: 12}]}>
            <Text style={styles.creatureName}>
              {userCreatures[userSelectedCreature].name}  <Text style={styles.creatureStat}>
                ⚔️ {userCreatures[userSelectedCreature].stats.power} ⚡ {userCreatures[userSelectedCreature].stats.speed} 🛡️ {userCreatures[userSelectedCreature].stats.endurance}
              </Text>
            </Text>
          </View>
          <View style={[styles.creatureStats, {transform: [ {scaleX: -1} ], marginTop: 4}]}>
            <Text style={[styles.creatureRarity, { color: getRarityColor(userCreatures[userSelectedCreature].rarity) }]}>
              {userCreatures[userSelectedCreature].rarity.toUpperCase()}
            </Text>
            <Text style={[styles.creatureSportBadge, { 
              backgroundColor: getSportColor(userCreatures[userSelectedCreature].sport)[0],
             color: getSportColor(userCreatures[userSelectedCreature].sport)[1] }]}>
              {userCreatures[userSelectedCreature].sport}
            </Text>
          </View>
          <View style={styles.healthBarContainer}>
            <View style={styles.emptyHealthBar}>
              <View style={styles.healthBar}/>
            </View>
          </View>
          <IdleIcon 
              creature={userCreatures[userSelectedCreature]}
          /> 
        </View>
        <View style={styles.creature}>
          <View style={[styles.creatureStats, {justifyContent: 'flex-end', marginTop: 12}]}>
            <Text style={styles.creatureName}>
              {opponentCreatures[opponentSelectedCreature].name}  <Text style={styles.creatureStat}>
                ⚔️ {opponentCreatures[opponentSelectedCreature].stats.power} ⚡ {opponentCreatures[opponentSelectedCreature].stats.speed} 🛡️ {opponentCreatures[opponentSelectedCreature].stats.endurance}
              </Text>
            </Text>
          </View>
          <View style={[styles.creatureStats, {justifyContent: 'flex-end', marginTop: 4}]}>
            <Text style={[styles.creatureRarity, { color: getRarityColor(opponentCreatures[opponentSelectedCreature].rarity) }]}>
              {opponentCreatures[opponentSelectedCreature].rarity.toUpperCase()}
            </Text>
            <Text style={[styles.creatureSportBadge, { 
              backgroundColor: getSportColor(opponentCreatures[opponentSelectedCreature].sport)[0],
             color: getSportColor(opponentCreatures[opponentSelectedCreature].sport)[1] }]}>
              {opponentCreatures[opponentSelectedCreature].sport}
            </Text>
          </View>
          <View style={styles.healthBarContainer}>
            <View style={styles.emptyHealthBar}>
              <View style={styles.healthBar}/>
            </View>
          </View>
          <IdleIcon 
              creature={opponentCreatures[opponentSelectedCreature]}
          /> 
        </View>
      </View>
      <View style={styles.specialContainer}>
        <SpecialIcon 
          style={{marginBottom: 12}} 
          fill={getSportColor(userCreatures[userSelectedCreature].sport)[0]}
        />
      </View>
    </View>
  );
}
