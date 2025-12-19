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

interface DamageNumberProps {
  damage: number;
  isUser: boolean;
  effectiveness?: String;
  isSpecial: boolean;
  onComplete?: () => void;
}

export function DamageNumber({ damage, isUser, effectiveness, isSpecial, onComplete }: DamageNumberProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100, // fade in quickly
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20, // initial upward move
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // continue moving up and fading out
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -50,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete?.();
      });
    });
  }, []);

  return (
    <Animated.Text
      style={[
        {
          color: (effectiveness === 'WEAK') ? '#10B981' : (effectiveness === 'RESIST') ? '#EF4444' : '#6B7280',
          position: 'absolute',
          textAlign: 'center',
          fontSize: isSpecial ? 30 : 24,
          fontWeight: isSpecial ? 'bold' : 'normal',
          bottom: 100, 
          left: 50, 
          opacity,
          transform: [{ translateY }, {scaleX: isUser ? -1 : 1 }],
        },
      ]}
    >
      -{damage}
      {effectiveness && 
      <>
        <br/>
        <Text style={[
          {
            color: (effectiveness === 'WEAK') ? '#10B981' : (effectiveness === 'RESIST') ? '#EF4444' : '#6B7280',
            fontSize: isSpecial ? 22 : 16
          }]}>
          {effectiveness}
        </Text>
      </>}
    </Animated.Text>
  );
}

interface FloatingDamage {
  id: string; // unique key
  creatureIndex: number; // which creature receives damage
  effectiveness?: String; // type effectiveness message
  isSpecial: boolean; // if the attack is special or normal
  amount: number;
}

interface ImpactEffectProps {
  onComplete?: () => void;
  sport: "GENERAL" | "RUNNING" | "SWIMMING" | "HIKING" | "FITNESS" | "CYCLING" | "CIRCUIT";
}

export function ImpactEffect({ onComplete, sport }: ImpactEffectProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate scale + opacity in
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animate fade out + slight scale up
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete?.();
      });
    });
  }, []);

  return (
    <Animated.View
      style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: [{ scale }],
        }}
    >
      <Svg viewBox="-10 -10 50 50" fill={getSportColor(sport)[0]}>
        <path
          d="M 31.578019,19.672316 C 28.510455,18.393603 25.469,15.853 24.862,13.866 c -0.498,-1.631 1.004,-3.801 3.836,-6.416 -2.958,1.621 -5.135,2.722 -5.997,1.185 -0.774,-1.38 0.093,-3.966 1.464,-7.357 0,0 -2.269267,3.7757324 -3.515861,4.0146035 C 19.447545,4.3341582 19.578881,0.20754497 19.578881,0.20754497 18.240881,3.204545 15.865,5.972 13.81,6.263 12.054,6.512 9.781,4.449 7.22,1.521 8.678,4.415 9.214,6.736 8.231,7.309 7.069,7.987 4.9651484,6.8502774 1.5171484,5.4022774 c 0,0 3.994129,2.6801191 3.9238516,4.5217226 -0.358,0.48 -2.9870249,0.397 -5.14402488,0.105 0,0 5.80702488,4.902 5.80702488,6.416 0,1.302 -3.7950299,5.632642 -6.00602985,7.738642 0,0 5.63702985,-1.568642 6.45902985,-0.102642 0.839,1.495 0.276,3.611 -0.802,6.695 0,0 5.667,-4.766 6.66,-4.672 0.703,0.066 0.453,4.672 0.453,4.672 1.743,-4.845 3.892,-7.814 7.078,-7.706 2.796,0.096 5.449,2.91 8.368,4.916 -1.526,-1.867 -5.650433,-5.441423 -4.208612,-5.578214 1.194214,-0.202592 5.769189,0.915209 5.769189,0.915209 -1.863,-1.271 -2.294711,-1.779375 -2.222577,-2.729995 0.450287,-1.406168 3.926019,-0.920684 3.926019,-0.920684 z M 21.948,18.081 c -0.335,0.334 1.759,1.577 2.956,2.438 -1.81,-0.632 -4.092,-1.582 -4.518,-1.234 -0.308,0.252 1.12,1.603 1.897,2.553 -1.485,-1.021 -2.845,-2.448 -4.267,-2.496 -2.092,-0.071 -3.29,2.442 -4.323,6.282 0.272,-1.823 1.089,-4.679 0.502,-4.733 -0.833,-0.078 -2.846,2.892 -4.351,5.106 1.051,-3.185 2.006,-5 1.367,-6.139 -0.577,-1.029 -2.744,-0.403 -3.682,0.143 1.105,-1.043 3.447,-3.141 3.447,-4.025 0,-1.286 -2.32,-2.733 -6.599,-3.951 2.572,0.405 5.888,1.149 6.275,0.631 0.303,-0.405 -2.192,-1.813 -3.71,-2.811 2.672,1.146 4.365,1.92 5.122,1.479 0.5,-0.292 0.222,-1.47 -0.52,-2.942 1.303,1.489 2.471,2.538 3.364,2.411 1.884,-0.267 2.698,-2.76 4.166,-7.518 v 0 C 18.729,5.923 18.03,9.24 18.46,9.644 18.782,9.947 20.096,7.5 21.11,5.943 c -1.144,2.886 -2.245,5.056 -1.69,6.045 0.439,0.782 1.552,0.23 3.056,-0.594 -1.44,1.33 -2.214,2.433 -1.961,3.263 0.503,1.647 2.857,2.292 7.065,3.766 -2.161,-0.28 -5.135,-0.842 -5.634,-0.344 z"
        />
      </Svg>
    </Animated.View>
  );
}

interface FloatingImpact {
  id: string;
  creatureIndex: number;
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

function calcDamage(attacker: Creature, defender: Creature): { amount: number, effectiveness?: String} {
  const typeDict = {'GENERAL': 0, 'RUNNING': 1, 'SWIMMING': 2, 'HIKING': 3, 'FITNESS': 4, 'CYCLING': 5, 'CIRCUIT': 6};
  const mult = typeMatchups[typeDict[attacker.sport]][typeDict[defender.sport]];
  const amount = Math.floor((attacker.stats.power/defender.stats.endurance*4+1)*mult);
  if (mult == 2) {
    return {amount, effectiveness: 'WEAK'};
  } else if (mult == 0.5) {
    return {amount, effectiveness: 'RESIST'};
  } else {
    return {amount};
  };
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

  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);

  const [floatingImpacts, setFloatingImpacts] = useState<FloatingImpact[]>([]);

  const battlePress = () => {

    if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;

    setClickNum(prev => prev + 1);
    if (clickNum < clicks[userSelectedCreature]) return;

    onCreatureAttack(creatures[userSelectedCreature].id);
    const damage = calcDamage(creatures[userSelectedCreature], creatures[opponentSelectedCreature]);

    setHealths(prev => {
      const next = [...prev];
      next[opponentSelectedCreature] = Math.max(next[opponentSelectedCreature]-damage.amount, 0);
      return next;
    });

    setFloatingDamages(prevDamages => [
      ...prevDamages,
      {
        id: Math.random().toString(),
        creatureIndex: opponentSelectedCreature,
        amount: damage.amount,
        effectiveness: damage.effectiveness,
        isSpecial: false
      }
    ]);

    setFloatingImpacts(prevImpacts => [
      ...prevImpacts,
      { id: Math.random().toString(), creatureIndex: opponentSelectedCreature }
    ]);

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
    const damage = calcDamage(creatures[userSelectedCreature], creatures[opponentSelectedCreature]);

    setHealths(prev => {
      const next = [...prev];
      next[opponentSelectedCreature] = Math.max(next[opponentSelectedCreature]-damage.amount*5, 0);
      return next;
    });

    setFloatingDamages(prevDamages => [
      ...prevDamages,
      {
        id: Math.random().toString(),
        creatureIndex: opponentSelectedCreature,
        amount: damage.amount*5,
        effectiveness: damage.effectiveness,
        isSpecial: true
      }
    ]);

    setFloatingImpacts(prevImpacts => [
      ...prevImpacts,
      { id: Math.random().toString(), creatureIndex: opponentSelectedCreature }
    ]);

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
      const damage = calcDamage(creatures[opponentSelectedCreature], creatures[userSelectedCreature]);
      
      if (charges[opponentSelectedCreature] < chargeMaxes[opponentSelectedCreature]) {
        setHealths(prev => {
          const next = [...prev];
          next[userSelectedCreature] = Math.max(next[userSelectedCreature]-damage.amount, 0);
          return next;
        });

        setFloatingDamages(prevDamages => [
          ...prevDamages,
          {
            id: Math.random().toString(),
            creatureIndex: userSelectedCreature,
            amount: damage.amount,
            effectiveness: damage.effectiveness,
            isSpecial: false
          }
        ]);
        
        setFloatingImpacts(prevImpacts => [
          ...prevImpacts,
          { id: Math.random().toString(), creatureIndex: userSelectedCreature }
        ]);

        setCharges(prev => {
          const next = [...prev];
          next[opponentSelectedCreature] += 1;
          return next;
        });
      } else {
        setHealths(prev => {
          const next = [...prev];
          next[userSelectedCreature] = Math.max(next[userSelectedCreature]-damage.amount*5, 0);
          return next;
        });

        setFloatingDamages(prevDamages => [
          ...prevDamages,
          {
            id: Math.random().toString(),
            creatureIndex: userSelectedCreature,
            amount: damage.amount*5,
            effectiveness: damage.effectiveness,
            isSpecial: true
          }
        ]);

        setFloatingImpacts(prevImpacts => [
          ...prevImpacts,
          { id: Math.random().toString(), creatureIndex: userSelectedCreature }
        ]);

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
            <View style={{ marginTop: 8 }}>
              {healths[userSelectedCreature] == 0 ? (
                <FaintedIcon creature={creatures[userSelectedCreature]} />
              ) : (
                <IdleIcon 
                  creature={creatures[userSelectedCreature]}
                  attackTrigger={(trigger) => (attackRefs.current[creatures[userSelectedCreature].id] = trigger)}
                />
              )}
              {floatingDamages
                .filter(d => d.creatureIndex === userSelectedCreature)
                .map(d => (
                  <DamageNumber
                    damage={d.amount}
                    isUser={true}
                    effectiveness={d.effectiveness}
                    isSpecial={d.isSpecial}
                    onComplete={() => {
                      setFloatingDamages(prev => prev.filter(f => f.id !== d.id));
                    }}
                  />
                ))}
              {floatingImpacts
                  .filter(f => f.creatureIndex === userSelectedCreature)
                  .map(f => (
                    <ImpactEffect
                      key={f.id}
                      onComplete={() => {
                        setFloatingImpacts(prev => prev.filter(x => x.id !== f.id));
                      }}
                      sport={creatures[opponentSelectedCreature].sport}
                    />
                  ))}
            </View>
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
            <View style={{ marginTop: 8 }}>
              {healths[opponentSelectedCreature] == 0 ? (
                <FaintedIcon creature={creatures[opponentSelectedCreature]} onFaintEnd={handleOpponentFaintEnd} />
              ) : (
                <IdleIcon 
                  creature={creatures[opponentSelectedCreature]}
                  attackTrigger={(trigger) => (attackRefs.current[creatures[opponentSelectedCreature].id] = trigger)}
                />
              )}
              {floatingDamages
                .filter(d => d.creatureIndex === opponentSelectedCreature)
                .map(d => (
                  <DamageNumber
                    damage={d.amount}
                    isUser={false}
                    effectiveness={d.effectiveness}
                    isSpecial={d.isSpecial}
                    onComplete={() => {
                      setFloatingDamages(prev => prev.filter(f => f.id !== d.id));
                    }}
                  />
                ))}
              {floatingImpacts
                .filter(f => f.creatureIndex === opponentSelectedCreature)
                .map(f => (
                  <ImpactEffect
                    key={f.id}
                    onComplete={() => {
                      setFloatingImpacts(prev => prev.filter(x => x.id !== f.id));
                    }}
                    sport={creatures[userSelectedCreature].sport}
                  />
                ))}
            </View>
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
