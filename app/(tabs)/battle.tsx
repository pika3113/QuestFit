import { View, Text } from '@/components/Themed';
import { battleStyles as styles } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Creature } from '@/src/types/polar';
import { getRarityColor, getSportColor } from '@/src/styles';
import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';

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

type SpecialProps = {
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

  const isComplete = current/max >= 1;
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

      {!isComplete && (
        <G clipPath="url(#progressClip)" fill={getSportColor(sport)[0]} opacity={0.5}>
          <SpecialIcon />
        </G>
      )}

      {isComplete && (
        <G clipPath="url(#progressClip)" fill={getSportColor(sport)[0]}>
          <SpecialIcon />
        </G>
      )}
    </Svg>
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
        <SpecialSvg 
          max={100}
          current={100}
          sport={userCreatures[userSelectedCreature].sport}
        />
      </View>
    </View>
  );
}
