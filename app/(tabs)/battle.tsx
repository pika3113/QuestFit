import { battleStyles as styles, getRarityColor, getSportColor, LEGENDARY_BADGE_GRADIENT_COLORS } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, InteractionManager, Modal, Platform, PixelRatio, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View, Text } from 'react-native';
import { Creature } from '@/src/types/polar';
import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/hooks/useAuth';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creatureCardStyles } from '@/src/styles/components/creatureCardStyles';
import { LEGENDARY_SPECTRUM_GRADIENT_COLORS } from '@/src/styles';
import { SafeAreaView as SACSafeAreaView } from 'react-native-safe-area-context';
import { CreatureCardGrid, CreatureCardGridSkeleton, CreatureDetailsModal } from '@/components/game/CreatureCard';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const SPORTS = ['GENERAL', 'RUNNING', 'SWIMMING', 'HIKING', 'FITNESS', 'CYCLING', 'CIRCUIT'];

type SortField = 'none' | 'rarity' | 'sport';
type SortDirection = 'asc' | 'desc';

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

function getCreatureImage(id: string | number) {
  try {
    return creatureImages(`./creature_icon_${String(id)}.png`);
  } catch {
    try {
      return creatureImages('./creature_icon_1.png');
    } catch {
      return undefined as any;
    }
  }
}

function BattlePickerCreatureIcon({ id, height, dimmed }: { id: string; height: number; dimmed: boolean }) {
  if (Platform.OS === 'web') {
    return (
      <Image
        source={getCreatureImage(id)}
        style={{ width: '100%', height, opacity: dimmed ? 0.55 : 1, imageRendering: 'pixelated' } as any}
        contentFit="contain"
      />
    );
  }

  // Skia isn't supported on web builds; this branch only renders on native.
  // We lazy-require to keep web bundling safe.
  const skia = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@shopify/react-native-skia') as any;
  }, []);

  const { Canvas, Image: SkiaImage, useImage, FilterMode, MipmapMode } = skia;
  const [layoutWidth, setLayoutWidth] = React.useState(0);
  const image = useImage(getCreatureImage(id));
  const pr = PixelRatio.get();
  const snap = React.useCallback((v: number) => Math.round(v * pr) / pr, [pr]);

  return (
    <View
      style={{ width: '100%', height, opacity: dimmed ? 0.55 : 1 }}
      onLayout={(e) => {
        setLayoutWidth(e.nativeEvent.layout.width);
      }}
    >
      {layoutWidth > 0 && image && (
        <Canvas style={{ width: layoutWidth, height }}>
          <SkiaImage
            image={image}
            x={0}
            y={0}
            width={snap(layoutWidth)}
            height={snap(height)}
            fit="contain"
            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
          />
        </Canvas>
      )}
    </View>
  );
}

function BattleCreatureSprite({
  id,
  size,
  dimmed,
  fainted,
}: {
  id: string | number;
  size: number;
  dimmed?: boolean;
  fainted?: boolean;
}) {
  const opacity = dimmed ? 0.55 : 1;

  if (Platform.OS === 'web') {
    return (
      <View style={{ width: size, height: size, opacity }}>
        <Image
          source={getCreatureImage(id)}
          style={{ width: size, height: size, resizeMode: 'contain', imageRendering: 'pixelated' } as any}
          contentFit="contain"
        />
        {fainted && (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(107,114,128,0.35)',
            }}
          />
        )}
      </View>
    );
  }

  // Native: render pixel art crisply using Skia nearest-neighbor sampling (same approach as CreatureCard).
  const skia = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@shopify/react-native-skia') as any;
  }, []);

  const { Canvas, Image: SkiaImage, useImage, FilterMode, MipmapMode, Rect: SkiaRect } = skia;
  const image = useImage(getCreatureImage(id));
  const pr = PixelRatio.get();
  const snap = React.useCallback((v: number) => Math.round(v * pr) / pr, [pr]);

  return (
    <View style={{ width: size, height: size, opacity }}>
      {image && (() => {
        const srcW = image.width();
        const srcH = image.height();
        const maxScale = Math.min(size / srcW, size / srcH);
        const scale = maxScale >= 1 ? Math.max(1, Math.floor(maxScale)) : maxScale;

        const drawW = snap(srcW * scale);
        const drawH = snap(srcH * scale);
        const x = snap((size - drawW) / 2);
        const y = snap((size - drawH) / 2);

        return (
          <Canvas style={{ width: size, height: size }}>
            <SkiaImage
              image={image}
              x={x}
              y={y}
              width={drawW}
              height={drawH}
              fit="fill"
              sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
            />
            {fainted && <SkiaRect x={0} y={0} width={size} height={size} color="rgba(107,114,128,0.35)" />}
          </Canvas>
        );
      })()}
    </View>
  );
}

function ImpactEffect({ sport, onComplete }: { sport: Creature['sport']; onComplete?: () => void }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.65,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 520,
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
        <Path d="M 31.578019,19.672316 C 28.510455,18.393603 25.469,15.853 24.862,13.866 c -0.498,-1.631 1.004,-3.801 3.836,-6.416 -2.958,1.621 -5.135,2.722 -5.997,1.185 -0.774,-1.38 0.093,-3.966 1.464,-7.357 0,0 -2.269267,3.7757324 -3.515861,4.0146035 C 19.447545,4.3341582 19.578881,0.20754497 19.578881,0.20754497 18.240881,3.204545 15.865,5.972 13.81,6.263 12.054,6.512 9.781,4.449 7.22,1.521 8.678,4.415 9.214,6.736 8.231,7.309 7.069,7.987 4.9651484,6.8502774 1.5171484,5.4022774 c 0,0 3.994129,2.6801191 3.9238516,4.5217226 -0.358,0.48 -2.9870249,0.397 -5.14402488,0.105 0,0 5.80702488,4.902 5.80702488,6.416 0,1.302 -3.7950299,5.632642 -6.00602985,7.738642 0,0 5.63702985,-1.568642 6.45902985,-0.102642 0.839,1.495 0.276,3.611 -0.802,6.695 0,0 5.667,-4.766 6.66,-4.672 0.703,0.066 0.453,4.672 0.453,4.672 1.743,-4.845 3.892,-7.814 7.078,-7.706 2.796,0.096 5.449,2.91 8.368,4.916 -1.526,-1.867 -5.650433,-5.441423 -4.208612,-5.578214 1.194214,-0.202592 5.769189,0.915209 5.769189,0.915209 -1.863,-1.271 -2.294711,-1.779375 -2.222577,-2.729995 0.450287,-1.406168 3.926019,-0.920684 3.926019,-0.920684 z M 21.948,18.081 c -0.335,0.334 1.759,1.577 2.956,2.438 -1.81,-0.632 -4.092,-1.582 -4.518,-1.234 -0.308,0.252 1.12,1.603 1.897,2.553 -1.485,-1.021 -2.845,-2.448 -4.267,-2.496 -2.092,-0.071 -3.29,2.442 -4.323,6.282 0.272,-1.823 1.089,-4.679 0.502,-4.733 -0.833,-0.078 -2.846,2.892 -4.351,5.106 1.051,-3.185 2.006,-5 1.367,-6.139 -0.577,-1.029 -2.744,-0.403 -3.682,0.143 1.105,-1.043 3.447,-3.141 3.447,-4.025 0,-1.286 -2.32,-2.733 -6.599,-3.951 2.572,0.405 5.888,1.149 6.275,0.631 0.303,-0.405 -2.192,-1.813 -3.71,-2.811 2.672,1.146 4.365,1.92 5.122,1.479 0.5,-0.292 0.222,-1.47 -0.52,-2.942 1.303,1.489 2.471,2.538 3.364,2.411 1.884,-0.267 2.698,-2.76 4.166,-7.518 v 0 C 18.729,5.923 18.03,9.24 18.46,9.644 18.782,9.947 20.096,7.5 21.11,5.943 c -1.144,2.886 -2.245,5.056 -1.69,6.045 0.439,0.782 1.552,0.23 3.056,-0.594 -1.44,1.33 -2.214,2.433 -1.961,3.263 0.503,1.647 2.857,2.292 7.065,3.766 -2.161,-0.28 -5.135,-0.842 -5.634,-0.344 z" />
      </Svg>
    </Animated.View>
  );
}

interface FloatingDamage {
  id: string;
  creatureIndex: number;
  amount: number;
  effectiveness?: string;
  isSpecial?: boolean;
}

function DamageNumber({
  damage,
  isUser,
  effectiveness,
  isSpecial,
  onComplete,
}: {
  damage: number;
  isUser: boolean;
  effectiveness?: string;
  isSpecial?: boolean;
  onComplete?: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -32,
        duration: 720,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onComplete?.();
      });
    });
  }, []);

  const baseColor = isUser ? '#EF4444' : '#3B82F6';
  const specialColor = '#F59E0B';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '900',
          color: isSpecial ? specialColor : baseColor,
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowRadius: 6,
          textShadowOffset: { width: 0, height: 2 },
          textAlign: 'center',
        }}
      >
        -{damage}
      </Text>
      {!!effectiveness && (
        <Text style={{ marginTop: 2, fontSize: 12, fontWeight: '800', color: '#111827', textAlign: 'center' }}>
          {effectiveness}
        </Text>
      )}
    </Animated.View>
  );
}

function IdleIcon({
  creature,
  attackTrigger,
  size = 150,
}: {
  creature: Creature;
  attackTrigger: (trigger: () => void) => void;
  size?: number;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const attack = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ])
    );
    loop.start();

    const trigger = () => {
      attack.stopAnimation();
      attack.setValue(0);
      Animated.sequence([
        Animated.timing(attack, { toValue: 1, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(attack, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ]).start();
    };

    attackTrigger(trigger);

    return () => {
      loop.stop();
      attackTrigger(() => {});
    };
  }, [attackTrigger]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const scale = attack.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      <BattleCreatureSprite id={creature.id} size={size} />
    </Animated.View>
  );
}

function FaintedIcon({
  creature,
  onFaintEnd,
  size = 150,
}: {
  creature: Creature;
  onFaintEnd?: () => void;
  size?: number;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0.35, duration: 420, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 10, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start(() => {
      onFaintEnd?.();
    });
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <BattleCreatureSprite id={creature.id} size={size} fainted />
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
  variant?: 'default' | 'mobile';
}

function HealthBar({ health, maxHealth, variant = 'default' }: HealthBarProps) {
  const max = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 1;
  const ratioRaw = Number.isFinite(health) ? health / max : 0;
  const ratio = Math.max(0, Math.min(ratioRaw, 1));

  const containerStyle = variant === 'mobile' ? uiStyles.mobileHealthBarContainer : styles.healthBarContainer;
  const emptyStyle = variant === 'mobile' ? uiStyles.mobileEmptyHealthBar : styles.emptyHealthBar;
  const barStyle = variant === 'mobile' ? uiStyles.mobileHealthBar : styles.healthBar;

  return (
    <View style={containerStyle}>
      <View style={emptyStyle}>
        <View style={[barStyle, { flexGrow: ratio, flexBasis: 0 }]} />
        <View style={{ flexGrow: 1 - ratio, flexBasis: 0 }} />
      </View>
    </View>
  );
}

function calcDamage(attacker: Creature, defender: Creature): { amount: number; effectiveness?: string } {
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

  const { width: windowWidth } = useWindowDimensions();
  const isSmallMobile = windowWidth < 360;
  const mobileSpriteSize = isSmallMobile ? 120 : 150;
  const isCoarsePointerWeb = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }, []);

  // Treat touch-first web devices as "mobile" even if width is large (e.g. landscape phones).
  const isNarrowWeb = Platform.OS === 'web' && (windowWidth < 768 || isCoarsePointerWeb);
  const isDesktopWeb = Platform.OS === 'web' && !isNarrowWeb;

  const { user: authUser } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useGameProfile(authUser?.uid || null);

  const userName = authUser?.displayName || 'User';
  const opponentName = 'Opponent';

  const allCreatures = useMemo(() => creatureService.getAllCreatures(), []);
  const capturedCreatureIds = profile?.capturedCreatures || [];
  const capturedCreatures = useMemo(() => {
    return creatureService.getUnlockedCreatures(capturedCreatureIds);
  }, [capturedCreatureIds.join('|')]);

  const [phase, setPhase] = useState<'select' | 'battle'>('select');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);
  const [selectedUserCreatures, setSelectedUserCreatures] = useState<Array<Creature | null>>([
    null,
    null,
    null,
  ]);
  const [battleCreatures, setBattleCreatures] = useState<Creature[] | null>(null);

  const [creatureCooldowns, setCreatureCooldowns] = useState<Record<string, number>>({});
  const prevUserHealthsRef = useRef<number[]>([]);
  const cooldownsAppliedForBattleRef = useRef(false);

  const creatures = battleCreatures ?? [];
  const clicks = useMemo(() => creatures.map(calcClicks), [creatures]);
  const chargeMaxes = useMemo(() => creatures.map(calcChargeMax), [creatures]);

  const [clickNum, setClickNum] = useState(0);
  const [healths, setHealths] = useState<number[]>([]);
  const [charges, setCharges] = useState<number[]>([]);

  const [switchCooldownUntilMs, setSwitchCooldownUntilMs] = useState<number | null>(null);

  const didHydrateBattleSessionRef = useRef(false);

  // Refs for stable opponent attack scheduling (avoids resetting timers on every state update).
  const phaseRef = useRef<'select' | 'battle'>(phase);
  const battleCreaturesRef = useRef<Creature[] | null>(battleCreatures);
  const healthsRef = useRef<number[]>(healths);
  const chargesRef = useRef<number[]>(charges);
  const userSelectedCreatureRef = useRef<0 | 1 | 2>(0);
  const opponentSelectedCreatureRef = useRef<3 | 4 | 5>(3);
  const isBattleOverRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const clicksRef = useRef<number[]>(clicks);
  const chargeMaxesRef = useRef<number[]>(chargeMaxes);
  const opponentAttackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [battleResult, setBattleResult] = useState<'active' | 'victory' | 'defeat'>('active');
  const isBattleOver = battleResult !== 'active';
  const [defeatReason, setDefeatReason] = useState<'normal' | 'leftAfterReload'>('normal');
  const [pauseReason, setPauseReason] = useState<'restored' | 'manual' | 'creatures' | null>(null);

  const [isCreaturesModalOpen, setIsCreaturesModalOpen] = useState(false);
  const [isCreaturesModalContentReady, setIsCreaturesModalContentReady] = useState(false);
  const pauseSnapshotBeforeCreaturesRef = useRef<{
    isPaused: boolean;
    pauseReason: 'restored' | 'manual' | 'creatures' | null;
  } | null>(null);
  const [showCreatureDetails, setShowCreatureDetails] = useState(false);
  const [detailsCreature, setDetailsCreature] = useState<Creature>(() => creatureService.getAllCreatures()[0]!);
  const [detailsCaptured, setDetailsCaptured] = useState(false);

  // Creatures tab style: search/filter/sort state (all creatures modal)
  const [allCreaturesSearchQuery, setAllCreaturesSearchQuery] = useState('');
  const [allCreaturesStatusFilter, setAllCreaturesStatusFilter] = useState<'all' | 'captured' | 'locked'>('all');
  const [allCreaturesSelectedRarities, setAllCreaturesSelectedRarities] = useState<string[]>([]);
  const [allCreaturesSelectedSports, setAllCreaturesSelectedSports] = useState<string[]>([]);
  const [allCreaturesSortField, setAllCreaturesSortField] = useState<SortField>('none');
  const [allCreaturesSortDirection, setAllCreaturesSortDirection] = useState<SortDirection>('asc');
  const [showAllCreaturesFilterModal, setShowAllCreaturesFilterModal] = useState(false);

  // Creatures tab style: search/filter/sort state (captured creatures picker)
  const [pickCreaturesSearchQuery, setPickCreaturesSearchQuery] = useState('');
  const [pickCreaturesSelectedRarities, setPickCreaturesSelectedRarities] = useState<string[]>([]);
  const [pickCreaturesSelectedSports, setPickCreaturesSelectedSports] = useState<string[]>([]);
  const [pickCreaturesSortField, setPickCreaturesSortField] = useState<SortField>('none');
  const [pickCreaturesSortDirection, setPickCreaturesSortDirection] = useState<SortDirection>('asc');
  const [showPickCreaturesFilterModal, setShowPickCreaturesFilterModal] = useState(false);
  const [isPickCreaturesControlsCollapsed, setIsPickCreaturesControlsCollapsed] = useState(true);
  const [pickCreaturesBattleStateFilter, setPickCreaturesBattleStateFilter] = useState<'all' | 'alive' | 'fainted'>('all');

  useEffect(() => {
    if (phase !== 'select') return;
    setActiveSlot(0);
    setSelectedUserCreatures([null, null, null]);
  }, [phase]);

  const victoryRewardAppliedRef = useRef(false);
  const [victoryRewardEarned, setVictoryRewardEarned] = useState<number>(0);

  const getLocalDayKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getOpponentRarityBonus = (rarity: Creature['rarity']) => {
    // Reward beating higher rarity opponents more.
    switch (rarity) {
      case 'common':
        return 0;
      case 'rare':
        return 25;
      case 'epic':
        return 75;
      case 'legendary':
        return 150;
      default:
        return 0;
    }
  };

  const getDailyWinMultiplier = (winsSoFarToday: number) => {
    // Diminishing returns:
    // 0-4 wins: 100%
    // 5-14 wins: 75%
    // 15+ wins: 50%
    if (winsSoFarToday >= 15) return 0.5;
    if (winsSoFarToday >= 5) return 0.75;
    return 1;
  };

  const cooldownStorageKey = authUser?.uid ? `CREATURE_COOLDOWNS_${authUser.uid}` : null;
  const battleSessionStorageKey = authUser?.uid ? `BATTLE_SESSION_${authUser.uid}` : null;

  const formatCooldown = (untilMs: number) => {
    const remainingMs = Math.max(untilMs - nowMs, 0);
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours <= 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const isCreatureOnCooldown = (creatureId: string) => {
    const until = creatureCooldowns[creatureId];
    return typeof until === 'number' && until > nowMs;
  };

  const creatureCards = useMemo(() => {
    const capturedSet = new Set(capturedCreatureIds);
    return allCreatures.map(creature => ({
      creature,
      captured: capturedSet.has(creature.id),
    }));
  }, [allCreatures, capturedCreatureIds.join('|')]);

  const toggleSelection = (current: string[], value: string) => {
    if (current.includes(value)) return current.filter(v => v !== value);
    return [...current, value];
  };

  const rarityOrder: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const sportOrder = Object.fromEntries(SPORTS.map((s, idx) => [s, idx])) as Record<string, number>;

  const allCreaturesActiveFiltersCount =
    (allCreaturesStatusFilter !== 'all' ? 1 : 0) +
    (allCreaturesSelectedRarities.length > 0 ? 1 : 0) +
    (allCreaturesSelectedSports.length > 0 ? 1 : 0) +
    (allCreaturesSortField !== 'none' ? 1 : 0);

  const pickCreaturesActiveFiltersCount =
    (pickCreaturesSelectedRarities.length > 0 ? 1 : 0) +
    (pickCreaturesSelectedSports.length > 0 ? 1 : 0) +
    (pickCreaturesSortField !== 'none' ? 1 : 0) +
    (pickCreaturesBattleStateFilter !== 'all' ? 1 : 0);

  const filteredAndSortedAllCreatureCards = useMemo(() => {
    const q = allCreaturesSearchQuery.trim().toLowerCase();
    const filtered = creatureCards.filter(card => {
      const matchesSearch = q.length === 0 ? true : card.creature.name.toLowerCase().includes(q);
      const matchesStatus = allCreaturesStatusFilter === 'all'
        ? true
        : allCreaturesStatusFilter === 'captured' ? card.captured : !card.captured;
      const matchesRarity = allCreaturesSelectedRarities.length === 0 ? true : allCreaturesSelectedRarities.includes(card.creature.rarity);
      const matchesSport = allCreaturesSelectedSports.length === 0 ? true : allCreaturesSelectedSports.includes(card.creature.sport);
      return matchesSearch && matchesStatus && matchesRarity && matchesSport;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (allCreaturesSortField === 'none') return 0;

      let cmp = 0;
      if (allCreaturesSortField === 'rarity') {
        cmp = (rarityOrder[a.creature.rarity] ?? 999) - (rarityOrder[b.creature.rarity] ?? 999);
      } else if (allCreaturesSortField === 'sport') {
        cmp = (sportOrder[a.creature.sport] ?? 999) - (sportOrder[b.creature.sport] ?? 999);
      }

      if (cmp === 0) {
        cmp = a.creature.name.localeCompare(b.creature.name);
      }

      return allCreaturesSortDirection === 'desc' ? -cmp : cmp;
    });

    return { filteredCount: filtered.length, cards: sorted };
  }, [
    creatureCards,
    allCreaturesSearchQuery,
    allCreaturesStatusFilter,
    allCreaturesSelectedRarities,
    allCreaturesSelectedSports,
    allCreaturesSortField,
    allCreaturesSortDirection,
  ]);

  const filteredAndSortedPickCreatures = useMemo(() => {
    const q = pickCreaturesSearchQuery.trim().toLowerCase();
    const filtered = capturedCreatures.filter(c => {
      const matchesSearch = q.length === 0 ? true : c.name.toLowerCase().includes(q);
      const matchesRarity = pickCreaturesSelectedRarities.length === 0 ? true : pickCreaturesSelectedRarities.includes(c.rarity);
      const matchesSport = pickCreaturesSelectedSports.length === 0 ? true : pickCreaturesSelectedSports.includes(c.sport);
      const matchesBattleState = pickCreaturesBattleStateFilter === 'all'
        ? true
        : pickCreaturesBattleStateFilter === 'fainted'
          ? isCreatureOnCooldown(c.id)
          : !isCreatureOnCooldown(c.id);
      return matchesSearch && matchesRarity && matchesSport && matchesBattleState;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (pickCreaturesSortField === 'none') return 0;

      let cmp = 0;
      if (pickCreaturesSortField === 'rarity') {
        cmp = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
      } else if (pickCreaturesSortField === 'sport') {
        cmp = (sportOrder[a.sport] ?? 999) - (sportOrder[b.sport] ?? 999);
      }

      if (cmp === 0) {
        cmp = a.name.localeCompare(b.name);
      }

      return pickCreaturesSortDirection === 'desc' ? -cmp : cmp;
    });

    return { filteredCount: filtered.length, creatures: sorted };
  }, [
    capturedCreatures,
    pickCreaturesSearchQuery,
    pickCreaturesSelectedRarities,
    pickCreaturesSelectedSports,
    pickCreaturesSortField,
    pickCreaturesSortDirection,
    pickCreaturesBattleStateFilter,
    creatureCooldowns,
    nowMs,
  ]);

  const openCreaturesModal = () => {
    pauseSnapshotBeforeCreaturesRef.current = {
      isPaused,
      pauseReason,
    };

    setIsCreaturesModalContentReady(false);
    setIsCreaturesModalOpen(true);

    if (phase === 'battle' && !isPaused) {
      setPauseReason('creatures');
      setIsPaused(true);
    }

    // Defer heavy grid rendering until after the modal transition starts.
    InteractionManager.runAfterInteractions(() => {
      setIsCreaturesModalContentReady(true);
    });
  };

  const closeCreaturesModal = () => {
    setIsCreaturesModalContentReady(false);
    setIsCreaturesModalOpen(false);
    setShowCreatureDetails(false);

    const snapshot = pauseSnapshotBeforeCreaturesRef.current;
    pauseSnapshotBeforeCreaturesRef.current = null;

    if (!snapshot) {
      if (pauseReason === 'creatures') {
        setPauseReason(null);
        setIsPaused(false);
      }
      return;
    }

    setPauseReason(snapshot.pauseReason);
    setIsPaused(snapshot.isPaused);
  };

  const creaturesModal = (
    <Modal
      visible={isCreaturesModalOpen}
      animationType="slide"
      onRequestClose={closeCreaturesModal}
    >
      <SACSafeAreaView style={uiStyles.creaturesModalSafeArea}>
        <View
          style={uiStyles.creaturesModalHeader}
        >
          <Text style={uiStyles.creaturesModalTitle}>Creatures</Text>
          <Pressable
            onPress={closeCreaturesModal}
            style={({ pressed }) => [uiStyles.creaturesModalCloseButton, pressed && uiStyles.buttonPressed085]}
          >
            <Text style={uiStyles.creaturesModalCloseText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView style={uiStyles.flex1} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <View style={uiStyles.creaturesModalCountRow}>
            <Text style={uiStyles.creaturesModalCountText}>
              {capturedCreatureIds.length} captured, {allCreatures.length - capturedCreatureIds.length} remaining
              {(allCreaturesActiveFiltersCount > 0 || allCreaturesSearchQuery.length > 0) && ` • Showing ${filteredAndSortedAllCreatureCards.filteredCount} filtered`}
            </Text>
          </View>

          <View style={uiStyles.searchContainer}>
            <View style={uiStyles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={uiStyles.searchInput}
                placeholder="Search creatures..."
                value={allCreaturesSearchQuery}
                onChangeText={setAllCreaturesSearchQuery}
                placeholderTextColor="#999"
              />
              {allCreaturesSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAllCreaturesSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[uiStyles.filterButton, allCreaturesActiveFiltersCount > 0 && uiStyles.filterButtonActive]}
              onPress={() => setShowAllCreaturesFilterModal(true)}
            >
              <Ionicons name="options" size={20} color={allCreaturesActiveFiltersCount > 0 ? '#FFF' : '#666'} />
              {allCreaturesActiveFiltersCount > 0 && (
                <View style={uiStyles.badge}>
                  <Text style={uiStyles.badgeText}>{allCreaturesActiveFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {!isCreaturesModalContentReady ? (
            <CreatureCardGridSkeleton count={6} />
          ) : profileLoading ? (
            <CreatureCardGridSkeleton count={12} />
          ) : (
            <CreatureCardGrid
              cards={filteredAndSortedAllCreatureCards.cards}
              onPress={(id) => {
                const card = creatureCards.find(c => parseInt(c.creature.id) === id);
                if (!card) return;
                setDetailsCreature(card.creature);
                setDetailsCaptured(card.captured);
                setShowCreatureDetails(true);
              }}
            />
          )}

          {isCreaturesModalContentReady && !profileLoading && filteredAndSortedAllCreatureCards.cards.length === 0 && (
            <View style={uiStyles.emptyState}>
              <Text style={uiStyles.emptyStateText}>No creatures found matching your filters.</Text>
              <TouchableOpacity
                onPress={() => {
                  setAllCreaturesSearchQuery('');
                  setAllCreaturesStatusFilter('all');
                  setAllCreaturesSelectedRarities([]);
                  setAllCreaturesSelectedSports([]);
                  setAllCreaturesSortField('none');
                  setAllCreaturesSortDirection('asc');
                }}
              >
                <Text style={uiStyles.clearFiltersText}>Clear all filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Filter Modal (All Creatures) */}
        <Modal
          visible={showAllCreaturesFilterModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllCreaturesFilterModal(false)}
        >
          <View style={uiStyles.modalOverlay}>
            <View style={uiStyles.modalContent}>
              <View style={uiStyles.modalHeader}>
                <Text style={uiStyles.modalTitle}>Filter Creatures</Text>
                <TouchableOpacity onPress={() => setShowAllCreaturesFilterModal(false)}>
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={uiStyles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={uiStyles.filterLabel}>Status</Text>
                <View style={uiStyles.chipContainer}>
                  {(['all', 'captured', 'locked'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[uiStyles.chip, allCreaturesStatusFilter === status && uiStyles.chipActive]}
                      onPress={() => setAllCreaturesStatusFilter(status)}
                    >
                      <Text style={[uiStyles.chipText, allCreaturesStatusFilter === status && uiStyles.chipTextActive]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>


                <Text style={uiStyles.filterLabel}>Rarity</Text>
                <View style={uiStyles.chipContainer}>
                  <TouchableOpacity
                    style={[uiStyles.chip, allCreaturesSelectedRarities.length === 0 && uiStyles.chipActive]}
                    onPress={() => setAllCreaturesSelectedRarities([])}
                  >
                    <Text style={[uiStyles.chipText, allCreaturesSelectedRarities.length === 0 && uiStyles.chipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {RARITIES.map((rarity) => (
                    <TouchableOpacity
                      key={rarity}
                      style={[uiStyles.chip, allCreaturesSelectedRarities.includes(rarity) && uiStyles.chipActive]}
                      onPress={() => setAllCreaturesSelectedRarities((prev) => toggleSelection(prev, rarity))}
                    >
                      <Text style={[uiStyles.chipText, allCreaturesSelectedRarities.includes(rarity) && uiStyles.chipTextActive]}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={uiStyles.filterLabel}>Exercise Type</Text>
                <View style={uiStyles.chipContainer}>
                  <TouchableOpacity
                    style={[uiStyles.chip, allCreaturesSelectedSports.length === 0 && uiStyles.chipActive]}
                    onPress={() => setAllCreaturesSelectedSports([])}
                  >
                    <Text style={[uiStyles.chipText, allCreaturesSelectedSports.length === 0 && uiStyles.chipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {SPORTS.map((sport) => (
                    <TouchableOpacity
                      key={sport}
                      style={[uiStyles.chip, allCreaturesSelectedSports.includes(sport) && uiStyles.chipActive]}
                      onPress={() => setAllCreaturesSelectedSports((prev) => toggleSelection(prev, sport))}
                    >
                      <Text style={[uiStyles.chipText, allCreaturesSelectedSports.includes(sport) && uiStyles.chipTextActive]}>
                        {sport.charAt(0) + sport.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={uiStyles.filterLabel}>Sort</Text>
                <View style={uiStyles.chipContainer}>
                  {(
                    [
                      { key: 'none' as const, label: 'None' },
                      { key: 'rarity' as const, label: 'Rarity' },
                      { key: 'sport' as const, label: 'Exercise Type' },
                    ]
                  ).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[uiStyles.chip, allCreaturesSortField === opt.key && uiStyles.chipActive]}
                      onPress={() => setAllCreaturesSortField(opt.key)}
                    >
                      <Text style={[uiStyles.chipText, allCreaturesSortField === opt.key && uiStyles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={uiStyles.filterLabel}>Sort Order</Text>
                <View style={uiStyles.chipContainer}>
                  {(
                    [
                      { key: 'asc' as const, label: 'Asc' },
                      { key: 'desc' as const, label: 'Desc' },
                    ]
                  ).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[uiStyles.chip, allCreaturesSortDirection === opt.key && uiStyles.chipActive]}
                      onPress={() => setAllCreaturesSortDirection(opt.key)}
                    >
                      <Text style={[uiStyles.chipText, allCreaturesSortDirection === opt.key && uiStyles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={uiStyles.modalFooter}>
                <TouchableOpacity
                  style={uiStyles.resetButton}
                  onPress={() => {
                    setAllCreaturesStatusFilter('all');
                    setAllCreaturesSelectedRarities([]);
                    setAllCreaturesSelectedSports([]);
                    setAllCreaturesSortField('none');
                    setAllCreaturesSortDirection('asc');
                  }}
                >
                  <Text style={uiStyles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={uiStyles.applyButton}
                  onPress={() => setShowAllCreaturesFilterModal(false)}
                >
                  <Text style={uiStyles.applyButtonText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SACSafeAreaView>
    </Modal>
  );

  const creatureDetailsModal = (
    <CreatureDetailsModal
      visible={showCreatureDetails}
      creature={detailsCreature}
      captured={detailsCaptured}
      onClose={() => setShowCreatureDetails(false)}
    />
  );

  const xpBalance = profile?.xp ?? 0;

  const getCooldownClearCapCost = (rarity: Creature['rarity']) => {
    // Max cost when the cooldown has ~1h remaining.
    // Common -> Legendary
    switch (rarity) {
      case 'common':
        return 500;
      case 'rare':
        return 800;
      case 'epic':
        return 1200;
      case 'legendary':
        return 2500;
      default:
        return 800;
    }
  };

  const getCooldownClearBaseCost = (rarity: Creature['rarity']) => {
    // Minimum cost when the cooldown is almost finished.
    // Keep this meaningfully lower than the cap.
    switch (rarity) {
      case 'common':
        return 100;
      case 'rare':
        return 150;
      case 'epic':
        return 250;
      case 'legendary':
        return 500;
      default:
        return 150;
    }
  };

  const getCooldownClearCost = (creature: Creature) => {
    // QuestPoints are stored as XP.
    // Cost scales with remaining cooldown time up to a rarity-based cap.
    const untilMs = creatureCooldowns[creature.id];
    const cap = getCooldownClearCapCost(creature.rarity);
    const base = Math.min(getCooldownClearBaseCost(creature.rarity), cap);
    const rampStartMs = 15 * 60 * 1000;
    const rampFullMs = 50 * 60 * 1000;

    if (typeof untilMs !== 'number' || untilMs <= nowMs) return base;

    const remaining = Math.max(untilMs - nowMs, 0);

    // Base curve (original): remaining<=15m => base, remaining>=50m => cap.
    const t = Math.min(1, Math.max(0, (remaining - rampStartMs) / Math.max(1, rampFullMs - rampStartMs)));
    const raw = base + t * (cap - base);

    // Extra penalty for long cooldowns (e.g. premature quits set 2h cooldowns).
    // 2h remaining => 3x
    // 1.5h remaining => 2x
    // 1h remaining => 1x
    const oneHourMs = 60 * 60 * 1000;
    const ninetyMinMs = 90 * 60 * 1000;
    const twoHoursMs = 2 * 60 * 60 * 1000;

    let mult = 1;
    if (remaining > oneHourMs) {
      if (remaining >= twoHoursMs) {
        mult = 3;
      } else if (remaining >= ninetyMinMs) {
        const u = (remaining - ninetyMinMs) / Math.max(1, twoHoursMs - ninetyMinMs);
        // 1.5h..2h => 2..3
        mult = 2 + u;
      } else {
        const u = (remaining - oneHourMs) / Math.max(1, ninetyMinMs - oneHourMs);
        // 1h..1.5h => 1..2
        mult = 1 + u;
      }
    }

    const maxMult = 3;
    mult = Math.min(maxMult, Math.max(1, mult));
    const scaledRaw = raw * mult;

    // Round to a friendly number.
    const roundStep = scaledRaw <= 1200 ? 10 : scaledRaw <= 5000 ? 25 : 50;
    const rounded = Math.round(scaledRaw / roundStep) * roundStep;
    const scaledCap = cap * maxMult;
    return Math.max(base, Math.min(scaledCap, rounded));
  };

  const persistCooldownsAndXp = async (nextCooldowns: Record<string, number>, nextXp: number) => {
    setCreatureCooldowns(nextCooldowns);

    if (cooldownStorageKey) {
      try {
        await AsyncStorage.setItem(cooldownStorageKey, JSON.stringify(nextCooldowns));
      } catch {
        // best-effort
      }
    }

    try {
      await updateProfile({ creatureCooldowns: nextCooldowns, xp: nextXp });
    } catch {
      // best-effort
    }
  };

  const clearCreatureCooldownWithXp = (creature: Creature) => {
    const until = creatureCooldowns[creature.id];
    const onCooldown = typeof until === 'number' && until > nowMs;
    if (!onCooldown) return;

    const cost = getCooldownClearCost(creature);
    const currentXp = profile?.xp ?? 0;

    if (currentXp < cost) {
      Alert.alert('Not enough XP', `You need ${cost} XP to remove this cooldown.`);
      return;
    }

    const doClear = () => {
      const nextCooldowns = { ...creatureCooldowns };
      delete nextCooldowns[creature.id];
      persistCooldownsAndXp(nextCooldowns, currentXp - cost);
    };

    // Expo Web often doesn't surface Alert.alert reliably; use window.confirm there.
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(`Spend ${cost} XP to remove cooldown for ${creature.name}?`)
        : true;
      if (confirmed) doClear();
      return;
    }

    Alert.alert('Remove cooldown?', `Spend ${cost} XP to remove cooldown for ${creature.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: doClear },
    ]);
  };

  const persistCooldowns = async (next: Record<string, number>) => {
    setCreatureCooldowns(next);

    if (cooldownStorageKey) {
      try {
        await AsyncStorage.setItem(cooldownStorageKey, JSON.stringify(next));
      } catch {
        // best-effort
      }
    }

    // Best-effort Firestore persistence.
    try {
      await updateProfile({ creatureCooldowns: next });
    } catch {
      // best-effort
    }
  };

  const markCreatureCooldown = async (creatureId: string) => {
    const oneHourMs = 60 * 60 * 1000;
    const until = Date.now() + oneHourMs;

    const next: Record<string, number> = {
      ...creatureCooldowns,
      [creatureId]: Math.max(creatureCooldowns[creatureId] ?? 0, until),
    };

    await persistCooldowns(next);
  };

  const resetBattle = () => {
    setClickNum(0);
    setHealths([]);
    setCharges([]);
    setUserSelectedCreature(0);
    setOpponentSelectedCreature(3);
    setFloatingDamages([]);
    setFloatingImpacts([]);
    setCanSwitch(true);
    cooldownAnim.stopAnimation();
    cooldownAnim.setValue(0);
    setSwitchCooldownUntilMs(null);
    setBattleResult('active');
    setDefeatReason('normal');
    setPauseReason(null);
    victoryRewardAppliedRef.current = false;
    setVictoryRewardEarned(0);
    setBattleCreatures(null);
    setPhase('select');
    setIsPaused(false);

    didHydrateBattleSessionRef.current = false;

    if (battleSessionStorageKey) {
      AsyncStorage.removeItem(battleSessionStorageKey).catch(() => undefined);
    }
  };

  const openPause = () => {
    if (phase !== 'battle') return;
    if (isBattleOver) return;
    setPauseReason('manual');
    setIsPaused(true);
  };

  const forfeitBattle = () => {
    // Leave the battle immediately and return to the selection screen.
    // Premature quit penalty: faint the whole team for 2h.
    if (phase !== 'battle') return;

    const activeBattleCreatures = battleCreaturesRef.current;
    const idsToCooldown = activeBattleCreatures && activeBattleCreatures.length === 6
      ? [0, 1, 2].map(i => activeBattleCreatures[i]?.id).filter((id): id is string => !!id)
      : [];

    if (idsToCooldown.length > 0) {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const baseUntil = Date.now() + twoHoursMs;
      const next: Record<string, number> = { ...creatureCooldowns };
      for (const id of idsToCooldown) {
        next[id] = Math.max(next[id] ?? 0, baseUntil);
      }
      persistCooldowns(next);
    }

    // Reset battle state so the user lands back on selection (no defeat overlay).
    resetBattle();
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase !== 'battle') return false;

      // Premature quit penalty: faint the whole team for 2h, then return to selection.
      const activeBattleCreatures = battleCreaturesRef.current;
      const idsToCooldown = activeBattleCreatures && activeBattleCreatures.length === 6
        ? [0, 1, 2].map(i => activeBattleCreatures[i]?.id).filter((id): id is string => !!id)
        : [];

      if (idsToCooldown.length > 0) {
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const baseUntil = Date.now() + twoHoursMs;
        const next: Record<string, number> = { ...creatureCooldowns };
        for (const id of idsToCooldown) {
          next[id] = Math.max(next[id] ?? 0, baseUntil);
        }
        persistCooldowns(next);
      }

      resetBattle();
      return true;
    });

    return () => sub.remove();
  }, [phase, pauseReason, creatureCooldowns, persistCooldowns]);

  type PersistedBattleSessionV1 = {
    version: 1;
    savedAtMs: number;
    battleCreatureIds: string[]; // length 6
    healths: number[];
    charges: number[];
    userSelectedCreature: 0 | 1 | 2;
    opponentSelectedCreature: 3 | 4 | 5;
    clickNum: number;
    battleResult: 'active' | 'victory' | 'defeat';
    switchCooldownUntilMs: number | null;
  };

  const hydrateBattleFromSession = (session: PersistedBattleSessionV1) => {
    if (!session.battleCreatureIds || session.battleCreatureIds.length !== 6) return false;
    const hydrated = session.battleCreatureIds
      .map(id => creatureService.getCreatureById(id))
      .filter(Boolean) as Creature[];
    if (hydrated.length !== 6) return false;

    setBattleCreatures(hydrated);
    setPhase('battle');
    setBattleResult(session.battleResult ?? 'active');
    setHealths(Array.isArray(session.healths) ? session.healths : hydrated.map(c => c.stats.endurance));
    setCharges(Array.isArray(session.charges) ? session.charges : Array(6).fill(0));
    setUserSelectedCreature(session.userSelectedCreature ?? 0);
    setOpponentSelectedCreature(session.opponentSelectedCreature ?? 3);
    setClickNum(session.clickNum ?? 0);

    didHydrateBattleSessionRef.current = true;

    // Track transitions for death cooldowns.
    prevUserHealthsRef.current = Array.isArray(session.healths)
      ? session.healths
      : hydrated.map(c => c.stats.endurance);
    cooldownsAppliedForBattleRef.current = false;

    // Restore switch cooldown.
    setSwitchCooldownUntilMs(session.switchCooldownUntilMs ?? null);
    const until = session.switchCooldownUntilMs;
    if (typeof until === 'number' && until > Date.now()) {
      const remaining = until - Date.now();
      setCanSwitch(false);
      const total = 10000;
      cooldownAnim.stopAnimation();
      cooldownAnim.setValue(Math.min(Math.max(remaining / total, 0), 1));
      Animated.timing(cooldownAnim, {
        toValue: 0,
        duration: remaining,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        setCanSwitch(true);
        setSwitchCooldownUntilMs(null);
      });
    } else {
      setCanSwitch(true);
      cooldownAnim.stopAnimation();
      cooldownAnim.setValue(0);
    }

    // Always resume into a paused overlay so reload can't be used to dodge outcomes.
    if ((session.battleResult ?? 'active') === 'active') {
      setPauseReason('restored');
      setIsPaused(true);
    }
    return true;
  };
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    // Restore persisted battle session (if any) when opening battle screen.
    if (!battleSessionStorageKey) return;
    if (phase !== 'select') return;

    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(battleSessionStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PersistedBattleSessionV1;
        if (cancelled) return;
        if (!parsed || parsed.version !== 1) return;

        // If it already ended, drop the session.
        if (parsed.battleResult && parsed.battleResult !== 'active') {
          await AsyncStorage.removeItem(battleSessionStorageKey);
          return;
        }

        // Active session found while entering the screen means the user closed/reloaded mid-battle.
        // Premature quit penalty: faint the whole team for 2h, then clear the session.
        const idsToCooldown = Array.isArray(parsed.battleCreatureIds)
          ? parsed.battleCreatureIds.slice(0, 3).filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];

        if (idsToCooldown.length > 0) {
          const twoHoursMs = 2 * 60 * 60 * 1000;
          const baseUntil = Date.now() + twoHoursMs;
          const next: Record<string, number> = { ...creatureCooldowns };
          for (const id of idsToCooldown) {
            next[id] = Math.max(next[id] ?? 0, baseUntil);
          }
          await persistCooldowns(next);
        }

        await AsyncStorage.removeItem(battleSessionStorageKey);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [battleSessionStorageKey, phase]);

  useEffect(() => {
    // Persist active battle state so reload/navigation can't reset it.
    if (!battleSessionStorageKey) return;
    if (phase !== 'battle') {
      AsyncStorage.removeItem(battleSessionStorageKey).catch(() => undefined);
      return;
    }
    if (!battleCreatures || battleCreatures.length !== 6) return;

    // Clear session after battle ends.
    if (battleResult !== 'active') {
      AsyncStorage.removeItem(battleSessionStorageKey).catch(() => undefined);
      return;
    }

    const session: PersistedBattleSessionV1 = {
      version: 1,
      savedAtMs: Date.now(),
      battleCreatureIds: battleCreatures.map(c => c.id),
      healths,
      charges,
      userSelectedCreature,
      opponentSelectedCreature,
      clickNum,
      battleResult,
      switchCooldownUntilMs,
    };

    AsyncStorage.setItem(battleSessionStorageKey, JSON.stringify(session)).catch(() => undefined);
  }, [
    battleSessionStorageKey,
    phase,
    battleCreatures,
    healths,
    charges,
    userSelectedCreature,
    opponentSelectedCreature,
    clickNum,
    battleResult,
    switchCooldownUntilMs,
  ]);

  const buildOpponentTeam = (pool: Creature[]): Creature[] => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picks: Creature[] = [];
    let highRarityCount = 0;

    for (const c of shuffled) {
      if (picks.some(p => p.id === c.id)) continue;

      const isHigh = c.rarity === 'epic' || c.rarity === 'legendary';
      if (isHigh && highRarityCount >= 1) continue;

      picks.push(c);
      if (isHigh) highRarityCount += 1;

      if (picks.length === 3) break;
    }

    // Fallback: if pool is tiny for some reason.
    if (picks.length < 3) {
      for (const c of shuffled) {
        if (picks.length === 3) break;
        if (picks.some(p => p.id === c.id)) continue;
        picks.push(c);
      }
    }

    return picks.slice(0, 3);
  };

  const startBattle = () => {
    const team = selectedUserCreatures.filter(Boolean) as Creature[];
    if (team.length !== 3) return;

    // Block starting if any selected creature is on cooldown.
    if (team.some(c => isCreatureOnCooldown(c.id))) return;

    const opponentTeam = buildOpponentTeam(allCreatures);
    const nextCreatures = [...team, ...opponentTeam];

    didHydrateBattleSessionRef.current = false;
    setPauseReason(null);
    setDefeatReason('normal');
    victoryRewardAppliedRef.current = false;
    setVictoryRewardEarned(0);
    setBattleCreatures(nextCreatures);
    setPhase('battle');
    setIsPaused(false);
  };

  useEffect(() => {
    // Apply victory reward once per battle (combined A + D).
    if (phase !== 'battle') return;
    if (battleResult !== 'victory') return;
    if (victoryRewardAppliedRef.current) return;
    if (!profile) return;
    if (!battleCreatures || battleCreatures.length !== 6) return;

    victoryRewardAppliedRef.current = true;

    const base = 150;
    const opponentTeam = battleCreatures.slice(3, 6);
    const rarityBonus = opponentTeam.reduce((sum, c) => sum + getOpponentRarityBonus(c.rarity), 0);
    const rawReward = base + rarityBonus;

    const today = getLocalDayKey(new Date());
    const winsSoFarToday = profile.battleWinDay === today ? (profile.battleWinsToday ?? 0) : 0;
    const mult = getDailyWinMultiplier(winsSoFarToday);
    const reward = Math.max(0, Math.round(rawReward * mult));

    setVictoryRewardEarned(reward);

    const nextXp = (profile.xp ?? 0) + reward;
    const nextWinsToday = winsSoFarToday + 1;

    // Best-effort write; UI doesn't block.
    updateProfile({
      xp: nextXp,
      battleWinDay: today,
      battleWinsToday: nextWinsToday,
    });
  }, [battleResult, phase, profile, battleCreatures, updateProfile]);

  const selectCreatureForActiveSlot = (creature: Creature) => {
    if (isCreatureOnCooldown(creature.id)) return;

    setSelectedUserCreatures(prev => {
      const next = [...prev];

      const existingIndex = next.findIndex(c => c?.id === creature.id);
      if (existingIndex === activeSlot) {
        // Toggle off if tapping the same creature in the same slot.
        next[activeSlot] = null;
        return next;
      }

      if (existingIndex !== -1) {
        // Swap to preserve order.
        const tmp = next[activeSlot];
        next[activeSlot] = creature;
        next[existingIndex] = tmp;
        return next;
      }

      next[activeSlot] = creature;
      return next;
    });

    // Advance to next empty slot if possible.
    setActiveSlot(prev => {
      for (let i = 0; i < 3; i++) {
        const idx = ((prev + 1 + i) % 3) as 0 | 1 | 2;
        if (!selectedUserCreatures[idx]) return idx;
      }
      return prev;
    });
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    battleCreaturesRef.current = battleCreatures;
  }, [battleCreatures]);

  useEffect(() => {
    healthsRef.current = healths;
  }, [healths]);

  useEffect(() => {
    chargesRef.current = charges;
  }, [charges]);

  useEffect(() => {
    userSelectedCreatureRef.current = userSelectedCreature;
  }, [userSelectedCreature]);

  useEffect(() => {
    opponentSelectedCreatureRef.current = opponentSelectedCreature;
  }, [opponentSelectedCreature]);

  useEffect(() => {
    isBattleOverRef.current = isBattleOver;
  }, [isBattleOver]);

  useEffect(() => {
    clicksRef.current = clicks;
  }, [clicks]);

  useEffect(() => {
    chargeMaxesRef.current = chargeMaxes;
  }, [chargeMaxes]);

  useEffect(() => {
    // Update live clock for cooldown countdowns (picker + end-of-battle overlay).
    if (!(phase === 'select' || (phase === 'battle' && isBattleOver))) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, isBattleOver]);

  useEffect(() => {
    // Load cooldowns from AsyncStorage (fallback) when user changes.
    if (!cooldownStorageKey) return;
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(cooldownStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!cancelled && parsed && typeof parsed === 'object') {
          setCreatureCooldowns(parsed as Record<string, number>);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cooldownStorageKey]);

  useEffect(() => {
    // Merge Firestore cooldowns (source of truth when available) into local state.
    if (!profile?.creatureCooldowns) return;
    setCreatureCooldowns(prev => ({ ...prev, ...profile.creatureCooldowns }));
  }, [profile?.creatureCooldowns]);

  useEffect(() => {
    if (phase !== 'battle') return;
    if (!battleCreatures || battleCreatures.length !== 6) return;

    // If we hydrated from persisted session, keep the restored HP/charge/etc.
    if (didHydrateBattleSessionRef.current) {
      return;
    }

    setClickNum(0);
    setHealths(battleCreatures.map(c => c.stats.endurance));
    setCharges(Array(battleCreatures.length).fill(0));
    setUserSelectedCreature(0);
    setOpponentSelectedCreature(3);
    setFloatingDamages([]);
    setFloatingImpacts([]);
    setCanSwitch(true);
    cooldownAnim.stopAnimation();
    cooldownAnim.setValue(0);
    setSwitchCooldownUntilMs(null);
    setBattleResult('active');

    // Track transitions for death cooldowns.
    prevUserHealthsRef.current = battleCreatures.map(c => c.stats.endurance);
    cooldownsAppliedForBattleRef.current = false;
  }, [phase, battleCreatures]);

  useEffect(() => {
    // Apply cooldowns once, when the battle ends.
    if (phase !== 'battle') return;
    if (!battleCreatures || battleCreatures.length !== 6) return;
    if (!isBattleOver) return;
    if (cooldownsAppliedForBattleRef.current) return;

    cooldownsAppliedForBattleRef.current = true;

    const deadUserCreatureIds = [0, 1, 2]
      .filter(i => (healths[i] ?? 0) === 0)
      .map(i => battleCreatures[i]?.id)
      .filter((id): id is string => !!id);

    if (deadUserCreatureIds.length === 0) return;

    // Set all cooldowns in a single persist to avoid multiple writes.
    const oneHourMs = 60 * 60 * 1000;
    const baseUntil = Date.now() + oneHourMs;
    const next: Record<string, number> = { ...creatureCooldowns };
    for (const id of deadUserCreatureIds) {
      next[id] = Math.max(next[id] ?? 0, baseUntil);
    }

    // Fire-and-forget; no UI blocking.
    persistCooldowns(next);
  }, [phase, battleCreatures, isBattleOver, healths, creatureCooldowns]);

  const battlePress = () => {

    if (phase !== 'battle') return;
    if (!battleCreatures || battleCreatures.length !== 6) return;
    if (isBattleOver) return;
    if (isPaused) return;
    if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;

    setClickNum(prev => prev + 1);
    if (clickNum < (clicks[userSelectedCreature] ?? 0)) return;

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

    if (phase !== 'battle') return;
    if (!battleCreatures || battleCreatures.length !== 6) return;
    if (isBattleOver) return;
    if (isPaused) return;
    if (healths[userSelectedCreature] <= 0 || healths[opponentSelectedCreature] <= 0) return;
    if ((charges[userSelectedCreature] ?? 0) < (chargeMaxes[userSelectedCreature] ?? 0)) return;

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
    if (phase !== 'battle') return;
    if (isBattleOver) return;
    if (isPaused) return;
    if (!canSwitch) return;
    if (userSelectedCreature === index) return;
    if ((healths[index] ?? 0) <= 0) return;

    setUserSelectedCreature(index);
    setClickNum(0);

    setCanSwitch(false);
    cooldownAnim.setValue(1);

    const cooldownMs = 10000;
    const until = Date.now() + cooldownMs;
    setSwitchCooldownUntilMs(until);

    Animated.timing(cooldownAnim, {
      toValue: 0,
      duration: cooldownMs, // 10 seconds cooldown
      easing: Easing.linear,
      useNativeDriver: false, // height animation
    }).start(() => {
      setCanSwitch(true);
      setSwitchCooldownUntilMs(null);
    });
  };

  const fillHeight = cooldownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  const wrapHeaderSlot = (creature: Creature, child: React.ReactNode, isFainted: boolean) => {
    const content = (
      <View style={uiStyles.headerSlotContentWrap}>
        {child}
        {isFainted && <View pointerEvents="none" style={uiStyles.headerSlotFaintedOverlay} />}
      </View>
    );

    if (isFainted) {
      return (
        <View
          style={[
            creatureCardStyles.legendaryCardBorderWrap,
            {
              borderRadius: 12,
              padding: 2,
              margin: 2,
              backgroundColor: '#9CA3AF',
            },
          ]}
        >
          {content}
        </View>
      );
    }

    if (creature.rarity === 'legendary') {
      return (
        <LinearGradient
          colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            creatureCardStyles.legendaryCardBorderWrap,
            { borderRadius: 12, padding: 2, margin: 2 },
          ]}
        >
          {content}
        </LinearGradient>
      );
    }

    return (
      <View
        style={[
          creatureCardStyles.legendaryCardBorderWrap,
          {
            borderRadius: 12,
            padding: 2,
            margin: 2,
            backgroundColor: getRarityColor(creature.rarity),
          },
        ]}
      >
        {content}
      </View>
    );
  };

  function getNextAliveOpponent(
    healths: number[],
    start: 3 | 4 | 5
  ): 3 | 4 | 5 | null {
    for (let i = start; i <= 5; i++) {
      if (healths[i] > 0) return i as 3 | 4 | 5;
    }
    return null;
  }

  function getNextAliveUser(
    healths: number[],
    start: 0 | 1 | 2
  ): 0 | 1 | 2 | null {
    // Follow the user-defined order but wrap if needed (e.g. if they manually switched).
    for (let offset = 1; offset <= 3; offset++) {
      const idx = ((start + offset) % 3) as 0 | 1 | 2;
      if ((healths[idx] ?? 0) > 0) return idx;
    }
    return null;
  }

  const handleUserFaintEnd = () => {
    // If the currently-selected creature isn't actually fainted anymore (e.g. switched quickly), do nothing.
    if (healths[userSelectedCreature] > 0) return;

    const next = getNextAliveUser(healths, userSelectedCreature);
    if (next !== null) {
      setUserSelectedCreature(next);
      setClickNum(0);
      return;
    }

    setDefeatReason('normal');
    setBattleResult('defeat');
  };

  const handleOpponentFaintEnd = () => {
    setTimeout(() => {
      const next = getNextAliveOpponent(
        healths,
        (opponentSelectedCreature + 1) as 3 | 4 | 5
      );

      if (next !== null) {
        setOpponentSelectedCreature(next);
      } else {
        setBattleResult('victory');
      }
    }, 2500);
  };

  useEffect(() => {
    // Opponent attacks loop.
    // Important: do NOT depend on `healths`/`charges` here, otherwise spamming clicks resets the timer.
    if (opponentAttackTimeoutRef.current) {
      clearTimeout(opponentAttackTimeoutRef.current);
      opponentAttackTimeoutRef.current = null;
    }

    if (phase !== 'battle') return;
    if (!battleCreatures || battleCreatures.length !== 6) return;

    const scheduleNext = () => {
      const opponentIdx = opponentSelectedCreatureRef.current;
      const delay = (clicksRef.current[opponentIdx] ?? 5) * 200;

      opponentAttackTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current !== 'battle') {
          scheduleNext();
          return;
        }
        if (!battleCreaturesRef.current || battleCreaturesRef.current.length !== 6) {
          scheduleNext();
          return;
        }
        if (isBattleOverRef.current) {
          scheduleNext();
          return;
        }

        if (isPausedRef.current) {
          scheduleNext();
          return;
        }

        const currentHealths = healthsRef.current;
        const currentCharges = chargesRef.current;
        const userIdx = userSelectedCreatureRef.current;
        const oppIdx = opponentSelectedCreatureRef.current;

        if ((currentHealths[userIdx] ?? 0) <= 0 || (currentHealths[oppIdx] ?? 0) <= 0) {
          scheduleNext();
          return;
        }

        const currentCreatures = battleCreaturesRef.current;
        onCreatureAttack(currentCreatures[oppIdx].id);
        const damage = calcDamage(currentCreatures[oppIdx], currentCreatures[userIdx]);

        const canSpecial = (currentCharges[oppIdx] ?? 0) >= (chargeMaxesRef.current[oppIdx] ?? 0);
        const damageAmount = canSpecial ? damage.amount * 5 : damage.amount;

        setHealths(prev => {
          const next = [...prev];
          next[userIdx] = Math.max((next[userIdx] ?? 0) - damageAmount, 0);
          return next;
        });

        setFloatingDamages(prevDamages => [
          ...prevDamages,
          {
            id: Math.random().toString(),
            creatureIndex: userIdx,
            amount: damageAmount,
            effectiveness: damage.effectiveness,
            isSpecial: canSpecial,
          },
        ]);

        setFloatingImpacts(prevImpacts => [
          ...prevImpacts,
          { id: Math.random().toString(), creatureIndex: userIdx },
        ]);

        setCharges(prev => {
          const next = [...prev];
          next[oppIdx] = canSpecial ? 0 : (next[oppIdx] ?? 0) + 1;
          return next;
        });

        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (opponentAttackTimeoutRef.current) {
        clearTimeout(opponentAttackTimeoutRef.current);
        opponentAttackTimeoutRef.current = null;
      }
    };
  }, [phase, battleCreatures]);

  useEffect(() => { // if user creature faints
    if (healths[userSelectedCreature] > 0) return;

    cooldownAnim.stopAnimation();
    cooldownAnim.setValue(0);
    setCanSwitch(true);
  }, [healths[userSelectedCreature]]);

  useEffect(() => {
    if (phase !== 'battle') return;
    if (battleResult !== 'active') return;

    const anyUserAlive = healths.slice(0, 3).some(h => h > 0);
    const anyOpponentAlive = healths.slice(3, 6).some(h => h > 0);

    if (!anyUserAlive) {
      setDefeatReason(prev => (prev === 'leftAfterReload' ? prev : 'normal'));
      setBattleResult('defeat');
    }
    else if (!anyOpponentAlive) setBattleResult('victory');
  }, [battleResult, healths]);

  if (phase === 'select') {
    const hasEnoughCreatures = capturedCreatures.length >= 3;
    const allSlotsFilled = selectedUserCreatures.every(Boolean);

    return (
      <SACSafeAreaView style={[styles.container, { flex: 1, backgroundColor: '#F9FAFB' }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.header, { paddingVertical: 4 }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
            Select your 3 creatures
          </Text>
          <Pressable
            onPress={openCreaturesModal}
            style={({ pressed }) => [uiStyles.selectHeaderButton, pressed && uiStyles.buttonPressed085]}
          >
            <Text style={uiStyles.selectHeaderButtonText}>Creatures</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-start' }}>
          {[0, 1, 2].map((i) => {
            const idx = i as 0 | 1 | 2;
            const selected = selectedUserCreatures[idx];
            const isActive = activeSlot === idx;

            const innerSlot = (
              <Pressable
                key={idx}
                onPress={() => {
                  if (activeSlot === idx && selectedUserCreatures[idx]) {
                    setSelectedUserCreatures(prev => {
                      const next = [...prev];
                      next[idx] = null;
                      return next;
                    });
                    return;
                  }
                  setActiveSlot(idx);
                }}
                style={[uiStyles.selectSlotPressable, { borderColor: isActive ? '#3B82F6' : 'transparent' }]}
              >
                <Text style={uiStyles.selectSlotNumber}>#{idx + 1}</Text>
                {selected ? (
                  <>
                    <View style={uiStyles.selectSlotIcon}>
                      <BattlePickerCreatureIcon id={String(selected.id)} height={60} dimmed={false} />
                    </View>
                  </>
                ) : (
                  <View style={uiStyles.selectSlotIconPlaceholder}>
                    <Text style={{ color: '#6B7280' }}>Pick</Text>
                  </View>
                )}
                {selected ? (
                  <View style={uiStyles.selectSlotMeta}>
                    <Text
                      style={[uiStyles.selectSlotMetaName, isDesktopWeb ? null : uiStyles.selectSlotMetaNameMobile]}
                      numberOfLines={1}
                    >
                      {selected.name}
                    </Text>
                    <Text
                      style={[uiStyles.selectSlotMetaStats, isDesktopWeb ? null : uiStyles.selectSlotMetaStatsMobile]}
                      numberOfLines={1}
                    >
                      ⚔️ {selected.stats.power}  ⚡ {selected.stats.speed}  🛡️ {selected.stats.endurance}
                    </Text>
                  </View>
                ) : (
                  <Text style={uiStyles.selectSlotMetaHint}>
                    {isActive ? 'Active' : 'Tap'}
                  </Text>
                )}
              </Pressable>
            );

            if (!selected) {
              return (
                <View
                  key={idx}
                  style={uiStyles.selectSlotWrap}
                >
                  <Pressable
                    onPress={() => {
                      setActiveSlot(idx);
                    }}
                    style={[uiStyles.selectSlotPressable, { borderColor: isActive ? '#3B82F6' : '#E5E7EB' }]}
                  >
                    <Text style={uiStyles.selectSlotNumber}>#{idx + 1}</Text>
                    <View style={uiStyles.selectSlotIconPlaceholder}>
                      <Text style={{ color: '#6B7280' }}>Pick</Text>
                    </View>
                    <Text style={uiStyles.selectSlotMetaHint}>
                      {isActive ? 'Active' : 'Tap'}
                    </Text>
                  </Pressable>
                </View>
              );
            }

            if (selected.rarity === 'legendary') {
              return (
                <LinearGradient
                  key={idx}
                  colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={uiStyles.selectSlotWrap}
                >
                  {innerSlot}
                </LinearGradient>
              );
            }

            return (
              <View key={idx} style={[uiStyles.selectSlotWrap, { backgroundColor: getRarityColor(selected.rarity) }]}>
                {innerSlot}
              </View>
            );
          })}
        </View>

        {profileLoading ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#6B7280' }}>Loading your creatures...</Text>
          </View>
        ) : !hasEnoughCreatures ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#6B7280' }}>You need at least 3 captured creatures to battle.</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setIsPickCreaturesControlsCollapsed((prev) => !prev)}
              style={({ pressed }) => [
                uiStyles.pickControlsToggleRow,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.pickControlsToggleLabel}>Search / Filter</Text>
              <View style={uiStyles.pickControlsToggleRight}>
                {pickCreaturesActiveFiltersCount > 0 && (
                  <Text style={uiStyles.pickControlsToggleCount}>
                    {pickCreaturesActiveFiltersCount}
                  </Text>
                )}
                <Ionicons
                  name={isPickCreaturesControlsCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color="#6B7280"
                />
              </View>
            </Pressable>

            {!isPickCreaturesControlsCollapsed && (
              <View style={[uiStyles.searchContainer, uiStyles.pickControlsSearchContainer]}>
                <View style={uiStyles.searchBar}>
                  <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
                  <TextInput
                    style={uiStyles.searchInput}
                    placeholder="Search creatures..."
                    value={pickCreaturesSearchQuery}
                    onChangeText={setPickCreaturesSearchQuery}
                    placeholderTextColor="#999"
                  />
                  {pickCreaturesSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setPickCreaturesSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[uiStyles.filterButton, pickCreaturesActiveFiltersCount > 0 && uiStyles.filterButtonActive]}
                  onPress={() => setShowPickCreaturesFilterModal(true)}
                >
                  <Ionicons name="options" size={20} color={pickCreaturesActiveFiltersCount > 0 ? '#FFF' : '#666'} />
                  {pickCreaturesActiveFiltersCount > 0 && (
                    <View style={uiStyles.badge}>
                      <Text style={uiStyles.badgeText}>{pickCreaturesActiveFiltersCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                Showing {filteredAndSortedPickCreatures.filteredCount} of {capturedCreatures.length}
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
            >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {filteredAndSortedPickCreatures.creatures.map((c, index) => {
                const isSelected = selectedUserCreatures.some(s => s?.id === c.id);
                const cooldownUntil = creatureCooldowns[c.id];
                const onCooldown = typeof cooldownUntil === 'number' && cooldownUntil > nowMs;
                const clearCost = getCooldownClearCost(c);
                const canAffordClear = xpBalance >= clearCost;

                const rowStart = Math.floor(index / 3) * 3;
                const rowHasCooldown = (() => {
                  for (let i = rowStart; i < rowStart + 3 && i < filteredAndSortedPickCreatures.creatures.length; i++) {
                    const rowCreature = filteredAndSortedPickCreatures.creatures[i];
                    const until = creatureCooldowns[rowCreature.id];
                    if (typeof until === 'number' && until > nowMs) return true;
                  }
                  return false;
                })();

                const selectionBorderColor = onCooldown
                  ? '#6B7280'
                  : isSelected
                    ? '#10B981'
                    : 'transparent';

                const cardInner = (
                  <View
                    style={[
                      creatureCardStyles.card,
                      creatureCardStyles.legendaryCardInner,
                      {
                        width: '100%',
                        margin: 0,
                        padding: 8,
                        borderWidth: 2,
                        borderColor: selectionBorderColor,
                        backgroundColor: '#FFFFFF',
                      },
                      Platform.OS === 'web'
                        ? ({ cursor: onCooldown ? 'not-allowed' : 'default' } as any)
                        : null,
                    ]}
                  >
                    <Pressable
                      disabled={onCooldown}
                      onPress={() => selectCreatureForActiveSlot(c)}
                      style={[
                        { width: '100%' },
                        Platform.OS === 'web'
                          ? ({ cursor: onCooldown ? 'not-allowed' : 'pointer' } as any)
                          : null,
                      ]}
                    >
                      {isDesktopWeb ? (
                        <View style={[creatureCardStyles.header, uiStyles.creaturePickerCardHeader]}>
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={[creatureCardStyles.name, { fontSize: 13 }]} numberOfLines={2}>
                              {c.name}
                            </Text>
                            <Text style={[creatureCardStyles.id, { fontSize: 10 }]} numberOfLines={1}>
                              #{c.id}
                            </Text>
                          </View>
                          <View style={[creatureCardStyles.header, { alignItems: 'center' }]}>
                            <Text
                              style={[
                                creatureCardStyles.sport,
                                { color: getSportColor(c.sport)[0], fontSize: 10, marginLeft: 0 },
                              ]}
                              numberOfLines={1}
                            >
                              {c.sport}
                            </Text>
                            {c.rarity === 'legendary' ? (
                              <LinearGradient
                                colors={[...LEGENDARY_BADGE_GRADIENT_COLORS]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[creatureCardStyles.rarityBadge, { paddingHorizontal: 8, paddingVertical: 2 }]}
                              >
                                <Text style={[creatureCardStyles.legendaryBadgeText, { fontSize: 10 }]}>
                                  {c.rarity.toUpperCase()}
                                </Text>
                              </LinearGradient>
                            ) : (
                              <Text
                                style={[
                                  creatureCardStyles.rarityBadge,
                                  {
                                    backgroundColor: getRarityColor(c.rarity),
                                    color: '#FFFFFF',
                                    fontSize: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    overflow: 'hidden',
                                  },
                                ]}
                              >
                                {c.rarity.toUpperCase()}
                              </Text>
                            )}
                          </View>
                        </View>
                      ) : (
                        <View style={uiStyles.creaturePickerHeaderMobileWrap}>
                          <Text
                            style={[creatureCardStyles.name, uiStyles.creaturePickerNameMobile]}
                            numberOfLines={1}
                          >
                            {c.name}
                          </Text>
                          <View style={[creatureCardStyles.header, uiStyles.creaturePickerCardHeaderMobile]}>
                            <Text
                              style={[
                                creatureCardStyles.sport,
                                uiStyles.creaturePickerSportMobile,
                                { color: getSportColor(c.sport)[0] },
                              ]}
                              numberOfLines={1}
                            >
                              {c.sport}
                            </Text>
                            {c.rarity === 'legendary' ? (
                              <LinearGradient
                                colors={[...LEGENDARY_BADGE_GRADIENT_COLORS]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[creatureCardStyles.rarityBadge, uiStyles.creaturePickerRarityBadgeMobile]}
                              >
                                <Text
                                  style={[
                                    creatureCardStyles.legendaryBadgeText,
                                    uiStyles.creaturePickerRarityTextMobile,
                                    uiStyles.creaturePickerRarityBadgeTextMobile,
                                  ]}
                                >
                                  {c.rarity.toUpperCase()}
                                </Text>
                              </LinearGradient>
                            ) : (
                              <Text
                                style={[
                                  creatureCardStyles.rarityBadge,
                                  uiStyles.creaturePickerRarityBadgeMobile,
                                  uiStyles.creaturePickerRarityBadgeTextMobile,
                                  {
                                    backgroundColor: getRarityColor(c.rarity),
                                    color: '#FFFFFF',
                                  },
                                ]}
                              >
                                {c.rarity.toUpperCase()}
                              </Text>
                            )}
                          </View>
                        </View>
                      )}

                      <BattlePickerCreatureIcon id={String(c.id)} height={60} dimmed={onCooldown} />

                      <View style={[creatureCardStyles.stats, { marginBottom: 0, marginTop: 8 }]}>
                        <View style={creatureCardStyles.stat}>
                          <Text
                            style={[
                              creatureCardStyles.statLabel,
                              isDesktopWeb ? uiStyles.creaturePickerStatLabelDesktop : uiStyles.creaturePickerStatLabelMobile,
                            ]}
                          >
                            ⚔️{isDesktopWeb ? ' Power' : ''}
                          </Text>
                          <Text
                            style={[
                              creatureCardStyles.statValue,
                              isDesktopWeb ? uiStyles.creaturePickerStatValueDesktop : uiStyles.creaturePickerStatValueMobile,
                            ]}
                          >
                            {c.stats.power}
                          </Text>
                        </View>
                        <View style={creatureCardStyles.stat}>
                          <Text
                            style={[
                              creatureCardStyles.statLabel,
                              isDesktopWeb ? uiStyles.creaturePickerStatLabelDesktop : uiStyles.creaturePickerStatLabelMobile,
                            ]}
                          >
                            ⚡{isDesktopWeb ? ' Speed' : ''}
                          </Text>
                          <Text
                            style={[
                              creatureCardStyles.statValue,
                              isDesktopWeb ? uiStyles.creaturePickerStatValueDesktop : uiStyles.creaturePickerStatValueMobile,
                            ]}
                          >
                            {c.stats.speed}
                          </Text>
                        </View>
                        <View style={creatureCardStyles.stat}>
                          <Text
                            style={[
                              creatureCardStyles.statLabel,
                              isDesktopWeb ? uiStyles.creaturePickerStatLabelDesktop : uiStyles.creaturePickerStatLabelMobile,
                            ]}
                          >
                            🛡️{isDesktopWeb ? ' Endurance' : ''}
                          </Text>
                          <Text
                            style={[
                              creatureCardStyles.statValue,
                              isDesktopWeb ? uiStyles.creaturePickerStatValueDesktop : uiStyles.creaturePickerStatValueMobile,
                            ]}
                          >
                            {c.stats.endurance}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {rowHasCooldown &&
                      (onCooldown ? (
                        <>
                          <Text
                            style={[
                              uiStyles.cooldownLabel,
                              isDesktopWeb ? uiStyles.cooldownLabelDesktop : uiStyles.cooldownLabelMobile,
                            ]}
                          >
                            Cooldown: {formatCooldown(cooldownUntil!)}
                          </Text>
                          <Pressable
                            onPress={() => clearCreatureCooldownWithXp(c)}
                            disabled={!canAffordClear}
                            style={({ pressed }) => [
                              {
                                marginTop: 6,
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                borderRadius: 10,
                                backgroundColor: '#3B82F6',
                                opacity: !canAffordClear ? 0.35 : pressed ? 0.85 : 1,
                                width: '100%',
                                alignItems: 'center',
                              },
                              Platform.OS === 'web'
                                ? ({ cursor: !canAffordClear ? 'not-allowed' : 'pointer' } as any)
                                : null,
                            ]}
                          >
                            <Text
                              style={[
                                uiStyles.clearCooldownButtonText,
                                isDesktopWeb ? uiStyles.clearCooldownButtonTextDesktop : uiStyles.clearCooldownButtonTextMobile,
                              ]}
                            >
                              Clear ({clearCost} XP)
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <View style={{ opacity: 0 }} pointerEvents="none">
                          <Text
                            style={[
                              uiStyles.cooldownLabel,
                              isDesktopWeb ? uiStyles.cooldownLabelDesktop : uiStyles.cooldownLabelMobile,
                            ]}
                          >
                            Cooldown: 00:00
                          </Text>
                          <View
                            style={{
                              marginTop: 6,
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              borderRadius: 10,
                              backgroundColor: '#3B82F6',
                              width: '100%',
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={[
                                uiStyles.clearCooldownButtonText,
                                isDesktopWeb ? uiStyles.clearCooldownButtonTextDesktop : uiStyles.clearCooldownButtonTextMobile,
                              ]}
                            >
                              Clear (0 XP)
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                );

                return (
                  <View key={c.id} style={{ width: '31%', marginBottom: 12 }}>
                    {c.rarity === 'legendary' ? (
                      <LinearGradient
                        colors={[...LEGENDARY_SPECTRUM_GRADIENT_COLORS]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[creatureCardStyles.legendaryCardBorderWrap, { width: '100%' }]}
                      >
                        {cardInner}
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          creatureCardStyles.legendaryCardBorderWrap,
                          {
                            width: '100%',
                            backgroundColor: getRarityColor(c.rarity),
                          },
                        ]}
                      >
                        {cardInner}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            {filteredAndSortedPickCreatures.creatures.length === 0 && (
              <View style={[uiStyles.emptyState, { paddingHorizontal: 16 }]}>
                <Text style={uiStyles.emptyStateText}>No creatures found matching your filters.</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickCreaturesSearchQuery('');
                    setPickCreaturesBattleStateFilter('all');
                    setPickCreaturesSelectedRarities([]);
                    setPickCreaturesSelectedSports([]);
                    setPickCreaturesSortField('none');
                    setPickCreaturesSortDirection('asc');
                  }}
                >
                  <Text style={uiStyles.clearFiltersText}>Clear all filters</Text>
                </TouchableOpacity>
              </View>
            )}
            </ScrollView>

            {/* Filter Modal (Picker) */}
            <Modal
              visible={showPickCreaturesFilterModal}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setShowPickCreaturesFilterModal(false)}
            >
              <View style={uiStyles.modalOverlay}>
                <View style={uiStyles.modalContent}>
                  <View style={uiStyles.modalHeader}>
                    <Text style={uiStyles.modalTitle}>Filter Creatures</Text>
                    <TouchableOpacity onPress={() => setShowPickCreaturesFilterModal(false)}>
                      <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={uiStyles.modalBody} showsVerticalScrollIndicator={false}>
                    <View style={uiStyles.filterTwoColRow}>
                      <View style={[uiStyles.filterCol, uiStyles.filterColLeft]}>
                        <Text style={uiStyles.filterLabel}>Rarity</Text>
                        <View style={uiStyles.chipContainer}>
                          <TouchableOpacity
                            style={[uiStyles.chip, pickCreaturesSelectedRarities.length === 0 && uiStyles.chipActive]}
                            onPress={() => setPickCreaturesSelectedRarities([])}
                          >
                            <Text style={[uiStyles.chipText, pickCreaturesSelectedRarities.length === 0 && uiStyles.chipTextActive]}>All</Text>
                          </TouchableOpacity>
                          {RARITIES.map((rarity) => (
                            <TouchableOpacity
                              key={rarity}
                              style={[uiStyles.chip, pickCreaturesSelectedRarities.includes(rarity) && uiStyles.chipActive]}
                              onPress={() => setPickCreaturesSelectedRarities((prev) => toggleSelection(prev, rarity))}
                            >
                              <Text style={[uiStyles.chipText, pickCreaturesSelectedRarities.includes(rarity) && uiStyles.chipTextActive]}>
                                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={uiStyles.filterLabel}>Exercise Type</Text>
                        <View style={uiStyles.chipContainer}>
                          <TouchableOpacity
                            style={[uiStyles.chip, pickCreaturesSelectedSports.length === 0 && uiStyles.chipActive]}
                            onPress={() => setPickCreaturesSelectedSports([])}
                          >
                            <Text style={[uiStyles.chipText, pickCreaturesSelectedSports.length === 0 && uiStyles.chipTextActive]}>All</Text>
                          </TouchableOpacity>
                          {SPORTS.map((sport) => (
                            <TouchableOpacity
                              key={sport}
                              style={[uiStyles.chip, pickCreaturesSelectedSports.includes(sport) && uiStyles.chipActive]}
                              onPress={() => setPickCreaturesSelectedSports((prev) => toggleSelection(prev, sport))}
                            >
                              <Text style={[uiStyles.chipText, pickCreaturesSelectedSports.includes(sport) && uiStyles.chipTextActive]}>
                                {sport.charAt(0) + sport.slice(1).toLowerCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={uiStyles.filterLabel}>Status</Text>
                        <View style={uiStyles.chipContainer}>
                          {(
                            [
                              { key: 'all' as const, label: 'All' },
                              { key: 'alive' as const, label: 'Alive' },
                              { key: 'fainted' as const, label: 'Fainted' },
                            ]
                          ).map((opt) => (
                            <TouchableOpacity
                              key={opt.key}
                              style={[uiStyles.chip, pickCreaturesBattleStateFilter === opt.key && uiStyles.chipActive]}
                              onPress={() => setPickCreaturesBattleStateFilter(opt.key)}
                            >
                              <Text style={[uiStyles.chipText, pickCreaturesBattleStateFilter === opt.key && uiStyles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View pointerEvents="none" style={uiStyles.filterColDivider} />

                      <View style={[uiStyles.filterCol, uiStyles.filterColRight]}>
                        <Text style={uiStyles.filterLabel}>Sort</Text>
                        <View style={uiStyles.chipContainer}>
                          {(
                            [
                              { key: 'none' as const, label: 'None' },
                              { key: 'rarity' as const, label: 'Rarity' },
                              { key: 'sport' as const, label: 'Exercise Type' },
                            ]
                          ).map((opt) => (
                            <TouchableOpacity
                              key={opt.key}
                              style={[uiStyles.chip, pickCreaturesSortField === opt.key && uiStyles.chipActive]}
                              onPress={() => setPickCreaturesSortField(opt.key)}
                            >
                              <Text style={[uiStyles.chipText, pickCreaturesSortField === opt.key && uiStyles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={uiStyles.filterLabel}>Sort Order</Text>
                        <View style={uiStyles.chipContainer}>
                          {(
                            [
                              { key: 'asc' as const, label: 'Asc' },
                              { key: 'desc' as const, label: 'Desc' },
                            ]
                          ).map((opt) => (
                            <TouchableOpacity
                              key={opt.key}
                              style={[uiStyles.chip, pickCreaturesSortDirection === opt.key && uiStyles.chipActive]}
                              onPress={() => setPickCreaturesSortDirection(opt.key)}
                            >
                              <Text style={[uiStyles.chipText, pickCreaturesSortDirection === opt.key && uiStyles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  <View style={uiStyles.modalFooter}>
                    <TouchableOpacity
                      style={uiStyles.resetButton}
                      onPress={() => {
                        setPickCreaturesBattleStateFilter('all');
                        setPickCreaturesSelectedRarities([]);
                        setPickCreaturesSelectedSports([]);
                        setPickCreaturesSortField('none');
                        setPickCreaturesSortDirection('asc');
                      }}
                    >
                      <Text style={uiStyles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={uiStyles.applyButton}
                      onPress={() => setShowPickCreaturesFilterModal(false)}
                    >
                      <Text style={uiStyles.applyButtonText}>Show Results</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}

        <View style={uiStyles.selectFooterBar}>
          <Text style={uiStyles.selectFooterXpText} numberOfLines={1}>
            QuestPoints: {xpBalance}
          </Text>
          <Pressable
            onPress={() => {
              const storageKey = authUser?.uid ? `LAST_TAB_PATH_${authUser.uid}` : 'LAST_TAB_PATH_ANON';
              void (async () => {
                const allowed = ['/home', '/workout', '/creatures', '/me', '/instr-dashboard'] as const;
                type AllowedTabPath = (typeof allowed)[number];

                const isAllowedTabPath = (value: string): value is AllowedTabPath =>
                  (allowed as readonly string[]).includes(value);

                const normalizeStoredPath = (value: string | null): AllowedTabPath | null => {
                  if (!value) return null;
                  if (isAllowedTabPath(value)) return value;
                  if (value.startsWith('/(tabs)/')) {
                    const withoutGroup = `/${value.slice('/(tabs)/'.length)}`;
                    if (isAllowedTabPath(withoutGroup)) return withoutGroup;
                  }
                  return null;
                };

                try {
                  const last = await AsyncStorage.getItem(storageKey);
                  const normalized = normalizeStoredPath(last);
                  if (normalized) {
                    router.push(normalized);
                    return;
                  }
                } catch {
                  // ignore
                }
                router.push('/home');
              })();
            }}
            style={({ pressed }) => [
              uiStyles.selectFooterQuitButton,
              pressed && uiStyles.buttonPressed085,
            ]}
          >
            <Text style={uiStyles.selectFooterQuitText} numberOfLines={1}>
              Quit Battle
            </Text>
          </Pressable>
          <Pressable
            onPress={startBattle}
            disabled={!hasEnoughCreatures || !allSlotsFilled || selectedUserCreatures.some(c => (c ? isCreatureOnCooldown(c.id) : false))}
            style={({ pressed }) => [
              uiStyles.selectFooterStartButton,
              {
                opacity: !hasEnoughCreatures || !allSlotsFilled || selectedUserCreatures.some(c => (c ? isCreatureOnCooldown(c.id) : false)) ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={uiStyles.selectFooterStartText} numberOfLines={1}>
              Start Battle
            </Text>
          </Pressable>
        </View>
        {creaturesModal}
        {creatureDetailsModal}
      </SACSafeAreaView>
    );
  }

  // Desktop web battle layout does not work well on narrow screens.
  // Use the mobile battle layout for narrow web (e.g. mobile browsers).
  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.username, {color: '#3B82F6'}]}>{userName}</Text>
        {phase === 'battle' && (
          <View style={uiStyles.battleHeaderActionsRow}>
            {!isBattleOver && (
              <Pressable
                onPress={openPause}
                style={({ pressed }) => [
                  uiStyles.battleHeaderSecondaryButton,
                  uiStyles.battleHeaderActionButtonWithMargin,
                  pressed && uiStyles.buttonPressed07,
                ]}
              >
                <Text style={uiStyles.battleHeaderSecondaryText}>Pause</Text>
              </Pressable>
            )}
          </View>
        )}
        <Text style={[styles.username, {color: '#EF4444'}]}>{opponentName}</Text>
      </View>
      <View style={[styles.header, {borderBottomWidth: 1, borderBottomColor: '#E5E7EB'}]}>
        <View style={styles.creatureHeader}>
          {wrapHeaderSlot(
            creatures[0],
            <Pressable
              disabled={isBattleOver || !canSwitch || healths[0] <= 0}
              onPress={() => switchCreature(0)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[0] <= 0 ? 0.4 : 1,
              }}
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
          , healths[0] <= 0)}
          {wrapHeaderSlot(
            creatures[1],
            <Pressable
              disabled={isBattleOver || !canSwitch || healths[1] <= 0}
              onPress={() => switchCreature(1)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[1] <= 0 ? 0.4 : 1,
              }}
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
          , healths[1] <= 0)}
          {wrapHeaderSlot(
            creatures[2],
            <Pressable
              disabled={isBattleOver || !canSwitch || healths[2] <= 0}
              onPress={() => switchCreature(2)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[2] <= 0 ? 0.4 : 1,
              }}
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
          , healths[2] <= 0)}
        </View>
        <View style={styles.creatureHeader}>
          {wrapHeaderSlot(
            creatures[3],
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[3] <= 0 ? 0.4 : 1,
              }}
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
          , healths[3] <= 0)}
          {wrapHeaderSlot(
            creatures[4],
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[4] <= 0 ? 0.4 : 1,
              }}
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
          , healths[4] <= 0)}
          {wrapHeaderSlot(
            creatures[5],
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                overflow: 'hidden',
                opacity: healths[5] <= 0 ? 0.4 : 1,
              }}
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
          , healths[5] <= 0)}
        </View>
      </View>
      <Pressable style={{flex: 1}} onPress={() => { battlePress(); }} disabled={isBattleOver || isPaused}>
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
                <FaintedIcon creature={creatures[userSelectedCreature]} onFaintEnd={handleUserFaintEnd} />
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
              disabled={isBattleOver || charges[userSelectedCreature] < chargeMaxes[userSelectedCreature]}
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

      {isBattleOver && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(107,114,128,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          pointerEvents="auto"
        >
          <View
            style={uiStyles.overlayCard}
            pointerEvents="auto"
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: battleResult === 'victory' ? '#10B981' : '#EF4444',
                marginBottom: 8,
              }}
            >
              {battleResult === 'victory' ? 'Victory' : 'Defeat'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 }}>
              {battleResult === 'victory'
                ? `Your opponent has no creatures left. You earned ${victoryRewardEarned} QP.`
                : defeatReason === 'leftAfterReload'
                  ? 'You left the battle after reloading. This counts as a loss.'
                  : 'Your active creature ran out of health.'}
            </Text>

            {battleCreatures && battleCreatures.length === 6 && (
              (() => {
                const cooldownItems = [0, 1, 2]
                  .map(i => {
                    const c = battleCreatures[i];
                    const until = c ? creatureCooldowns[c.id] : undefined;
                    if (!c || typeof until !== 'number' || until <= nowMs) return null;
                    return { id: c.id, name: c.name, until };
                  })
                  .filter(Boolean) as Array<{ id: string; name: string; until: number }>;

                if (cooldownItems.length === 0) return null;

                return (
                  <View style={{ width: '100%', marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>
                      Creature cooldowns (time left)
                    </Text>
                    {cooldownItems.map(item => (
                      <View key={item.id} style={{ marginBottom: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                          {item.name}: {formatCooldown(item.until)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()
            )}
            <Pressable
              onPress={resetBattle}
              style={({ pressed }) => [
                uiStyles.primaryButton,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Restart</Text>
            </Pressable>
          </View>
        </View>
      )}

      {creaturesModal}
      {creatureDetailsModal}

      {phase === 'battle' && !isBattleOver && isPaused && !isCreaturesModalOpen && (pauseReason === 'restored' || pauseReason === 'manual') && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(107,114,128,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          pointerEvents="auto"
        >
          <View
            style={uiStyles.overlayCard}
          >
            <Text style={uiStyles.overlayTitleMuted}>
              Paused
            </Text>
            <Text style={uiStyles.overlayBodyMuted}>
              {pauseReason === 'restored'
                ? 'Battle was restored after reloading. Resume to continue.'
                : 'Battle paused. Resume to continue.'}
            </Text>
            <Pressable
              onPress={() => setIsPaused(false)}
              style={({ pressed }) => [
                uiStyles.primaryButton,
                uiStyles.fullWidth,
                uiStyles.buttonWithBottomMargin,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Resume</Text>
            </Pressable>
            <Pressable
              onPress={forfeitBattle}
              style={({ pressed }) => [
                uiStyles.dangerButton,
                uiStyles.fullWidth,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Leave (Counts as loss)</Text>
            </Pressable>
          </View>
        </View>
      )}
      </View>
    );
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[battle] rendering MOBILE battle layout', { platform: Platform.OS });
  }

  return (
    <SACSafeAreaView style={uiStyles.mobileBattleContainer} edges={['top', 'bottom', 'left', 'right']}>
      {__DEV__ && (
        <View style={{ paddingHorizontal: 14, paddingTop: 6, backgroundColor: '#111827' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
            DEV: Mobile Battle UI (new layout)
          </Text>
        </View>
      )}
      <View style={uiStyles.mobileTopBar}>
        <View style={uiStyles.mobileTopBarRow}>
          <View style={uiStyles.mobileNamesBlock}>
            <Text style={uiStyles.mobileOpponentName} numberOfLines={1}>{opponentName}</Text>
            <Text style={uiStyles.mobileUserName} numberOfLines={1}>{userName}</Text>
          </View>

          {!isBattleOver && (
            <Pressable
              onPress={openPause}
              style={({ pressed }) => [
                uiStyles.mobilePauseButton,
                pressed && uiStyles.buttonPressed07,
              ]}
            >
              <Text style={uiStyles.mobilePauseText}>Pause</Text>
            </Pressable>
          )}
        </View>

        <View style={uiStyles.mobileEnemySlotsRow}>
          {[3, 4, 5].map((idx) => (
            <View key={idx} style={[uiStyles.mobileSlotWrap, isSmallMobile && uiStyles.mobileSlotWrapSmall]}>
              {wrapHeaderSlot(
                creatures[idx],
                <View style={[uiStyles.mobileSlotInner, isSmallMobile && uiStyles.mobileSlotInnerSmall]}>
                  <Image
                    source={getCreatureImage(creatures[idx].id)}
                    style={[
                      uiStyles.mobileSlotIcon,
                      isSmallMobile && uiStyles.mobileSlotIconSmall,
                      {
                        opacity: healths[idx] > 0 ? 1 : 0.35,
                        tintColor: healths[idx] <= 0 ? '#6B7280' : undefined,
                      },
                    ]}
                    contentFit="contain"
                  />
                </View>,
                healths[idx] <= 0
              )}
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={uiStyles.mobileArena}
        onPress={battlePress}
        disabled={isBattleOver || isPaused}
      >

        <View style={uiStyles.mobileArenaContent}>
          <View style={uiStyles.mobileArenaTopHalf}>
            <View style={[uiStyles.mobileCombatCardTop, isSmallMobile && uiStyles.mobileCombatCardTopSmall]}>
              <View style={[uiStyles.mobileCardHeaderRow, isSmallMobile && uiStyles.mobileCardHeaderRowSmall]}>
                <Text style={[uiStyles.mobileCardName, isSmallMobile && uiStyles.mobileCardNameSmall]} numberOfLines={1}>
                  {creatures[opponentSelectedCreature].name}
                </Text>
                <Text style={[uiStyles.mobileCardStats, isSmallMobile && uiStyles.mobileCardStatsSmall]} numberOfLines={1}>
                  ⚔️ {creatures[opponentSelectedCreature].stats.power}  ⚡ {creatures[opponentSelectedCreature].stats.speed}  🛡️ {creatures[opponentSelectedCreature].stats.endurance}
                </Text>
              </View>

              <View style={uiStyles.mobileCardBadgesRow}>
                <Text style={[styles.creatureSport, { color: getSportColor(creatures[opponentSelectedCreature].sport)[0] }]}>
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
                variant="mobile"
              />

              <View style={[uiStyles.mobileIconStage, isSmallMobile && uiStyles.mobileIconStageSmall]}>
                {healths[opponentSelectedCreature] === 0 ? (
                  <FaintedIcon creature={creatures[opponentSelectedCreature]} onFaintEnd={handleOpponentFaintEnd} size={mobileSpriteSize} />
                ) : (
                  <IdleIcon
                    creature={creatures[opponentSelectedCreature]}
                    size={mobileSpriteSize}
                    attackTrigger={(trigger) => (attackRefs.current[creatures[opponentSelectedCreature].id] = trigger)}
                  />
                )}

                {floatingDamages
                  .filter(d => d.creatureIndex === opponentSelectedCreature)
                  .map(d => (
                    <DamageNumber
                      key={d.id}
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

          <View style={uiStyles.mobileArenaBottomHalf}>
            <View style={[uiStyles.mobileCombatCardBottom, isSmallMobile && uiStyles.mobileCombatCardBottomSmall]}>
              <View style={[uiStyles.mobileCardHeaderRow, isSmallMobile && uiStyles.mobileCardHeaderRowSmall]}>
                <Text style={[uiStyles.mobileCardName, isSmallMobile && uiStyles.mobileCardNameSmall]} numberOfLines={1}>
                  {creatures[userSelectedCreature].name}
                </Text>
                <Text style={[uiStyles.mobileCardStats, isSmallMobile && uiStyles.mobileCardStatsSmall]} numberOfLines={1}>
                  ⚔️ {creatures[userSelectedCreature].stats.power}  ⚡ {creatures[userSelectedCreature].stats.speed}  🛡️ {creatures[userSelectedCreature].stats.endurance}
                </Text>
              </View>

              <View style={uiStyles.mobileCardBadgesRow}>
                <Text style={[styles.creatureSport, { color: getSportColor(creatures[userSelectedCreature].sport)[0] }]}>
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
                variant="mobile"
              />

              <View style={[uiStyles.mobileIconStage, isSmallMobile && uiStyles.mobileIconStageSmall]}>
                <View style={{ transform: [{ scaleX: -1 }] }}>
                  {healths[userSelectedCreature] === 0 ? (
                    <FaintedIcon creature={creatures[userSelectedCreature]} onFaintEnd={handleUserFaintEnd} size={mobileSpriteSize} />
                  ) : (
                    <IdleIcon
                      creature={creatures[userSelectedCreature]}
                      size={mobileSpriteSize}
                      attackTrigger={(trigger) => (attackRefs.current[creatures[userSelectedCreature].id] = trigger)}
                    />
                  )}
                </View>

                {floatingDamages
                  .filter(d => d.creatureIndex === userSelectedCreature)
                  .map(d => (
                    <DamageNumber
                      key={d.id}
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
          </View>
        </View>

        <View style={uiStyles.mobileTapHint}>
          <Text style={uiStyles.mobileTapHintTitle}>Tap anywhere to attack</Text>
          <Text style={uiStyles.mobileTapHintSub}>Taps: {clickNum}</Text>
        </View>
      </Pressable>

      <View style={uiStyles.mobileBottomBar}>
        <View style={uiStyles.mobileSlotsRow}>
          {[0, 1, 2].map((idx) => (
            <View key={idx} style={[uiStyles.mobileSlotWrap, isSmallMobile && uiStyles.mobileSlotWrapSmall]}>
              {wrapHeaderSlot(
                creatures[idx],
                <Pressable
                  hitSlop={12}
                  disabled={isBattleOver || !canSwitch || healths[idx] <= 0}
                  onPress={() => switchCreature(idx as 0 | 1 | 2)}
                  style={[
                    uiStyles.mobileSlotInner,
                    isSmallMobile && uiStyles.mobileSlotInnerSmall,
                    { opacity: healths[idx] <= 0 ? 0.35 : 1 },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cooldownFill,
                      {
                        height: fillHeight,
                        borderRadius: 10,
                      },
                    ]}
                  />
                  <Image
                    source={getCreatureImage(creatures[idx].id)}
                    style={[
                      uiStyles.mobileSlotIcon,
                      isSmallMobile && uiStyles.mobileSlotIconSmall,
                      {
                        opacity: canSwitch && healths[idx] > 0 ? 1 : 0.35,
                        tintColor: healths[idx] <= 0 ? '#6B7280' : undefined,
                      },
                    ]}
                    contentFit="contain"
                  />
                </Pressable>,
                healths[idx] <= 0
              )}
            </View>
          ))}
        </View>

        <Pressable
          onPress={specialPress}
          hitSlop={14}
          disabled={isBattleOver || charges[userSelectedCreature] < chargeMaxes[userSelectedCreature]}
          style={({ pressed }) => [
            uiStyles.mobileSpecialButton,
            pressed && uiStyles.buttonPressed07,
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

      {isBattleOver && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(107,114,128,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          pointerEvents="auto"
        >
          <View
            style={uiStyles.overlayCard}
            pointerEvents="auto"
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: battleResult === 'victory' ? '#10B981' : '#EF4444',
                marginBottom: 8,
              }}
            >
              {battleResult === 'victory' ? 'Victory' : 'Defeat'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 }}>
              {battleResult === 'victory'
                ? `Your opponent has no creatures left. You earned ${victoryRewardEarned} QP.`
                : defeatReason === 'leftAfterReload'
                  ? 'You left the battle after reloading. This counts as a loss.'
                  : 'Your active creature ran out of health.'}
            </Text>

            {battleCreatures && battleCreatures.length === 6 && (
              (() => {
                const cooldownItems = [0, 1, 2]
                  .map(i => {
                    const c = battleCreatures[i];
                    const until = c ? creatureCooldowns[c.id] : undefined;
                    if (!c || typeof until !== 'number' || until <= nowMs) return null;
                    return { id: c.id, name: c.name, until };
                  })
                  .filter(Boolean) as Array<{ id: string; name: string; until: number }>;

                if (cooldownItems.length === 0) return null;

                return (
                  <View style={{ width: '100%', marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>
                      Creature cooldowns (time left)
                    </Text>
                    {cooldownItems.map(item => (
                      <View key={item.id} style={{ marginBottom: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                          {item.name}: {formatCooldown(item.until)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()
            )}
            <Pressable
              onPress={resetBattle}
              style={({ pressed }) => [
                uiStyles.primaryButton,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Restart</Text>
            </Pressable>
          </View>
        </View>
      )}

      {creaturesModal}
      {creatureDetailsModal}

      {phase === 'battle' && !isBattleOver && isPaused && !isCreaturesModalOpen && (pauseReason === 'restored' || pauseReason === 'manual') && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(107,114,128,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          pointerEvents="auto"
        >
          <View
            style={uiStyles.overlayCard}
          >
            <Text style={uiStyles.overlayTitleMuted}>
              Paused
            </Text>
            <Text style={uiStyles.overlayBodyMuted}>
              {pauseReason === 'restored'
                ? 'Battle was restored after reloading. Resume to continue.'
                : 'Battle paused. Resume to continue.'}
            </Text>
            <Pressable
              onPress={() => setIsPaused(false)}
              style={({ pressed }) => [
                uiStyles.primaryButton,
                uiStyles.fullWidth,
                uiStyles.buttonWithBottomMargin,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Resume</Text>
            </Pressable>
            <Pressable
              onPress={forfeitBattle}
              style={({ pressed }) => [
                uiStyles.dangerButton,
                uiStyles.fullWidth,
                pressed && uiStyles.buttonPressed085,
              ]}
            >
              <Text style={uiStyles.primaryButtonText}>Leave (Counts as loss)</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SACSafeAreaView>
  );
}

const uiStyles = StyleSheet.create({
  flex1: { flex: 1 },

  // Battle select: picker controls (collapsible search/filter)
  pickControlsToggleRow: {
    paddingHorizontal: 16,
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickControlsToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  pickControlsToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickControlsToggleCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 8,
  },
  pickControlsSearchContainer: {
    marginTop: 0,
  },

  // Creature picker card tweaks
  creaturePickerCardHeader: {
    marginBottom: 0,
  },
  creaturePickerCardHeaderMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  creaturePickerHeaderMobileWrap: {
    width: '100%',
    marginBottom: 0,
  },
  creaturePickerNameMobile: {
    fontSize: 7.15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  creaturePickerSportMobile: {
    fontSize: 6.5,
    marginLeft: 0,
  },
  creaturePickerRarityBadgeMobile: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  creaturePickerRarityTextMobile: {
    fontSize: 6.5,
  },
  creaturePickerRarityBadgeTextMobile: {
    fontSize: 6.5,
  },

  creaturePickerStatLabelDesktop: {
    fontSize: 10,
  },
  creaturePickerStatLabelMobile: {
    fontSize: 6.5,
  },
  creaturePickerStatValueDesktop: {
    fontSize: 13,
  },
  creaturePickerStatValueMobile: {
    fontSize: 8.45,
  },

  cooldownLabel: {
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  cooldownLabelDesktop: {
    fontSize: 11,
  },
  cooldownLabelMobile: {
    fontSize: 7.15,
  },
  clearCooldownButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clearCooldownButtonTextDesktop: {
    fontSize: 10,
  },
  clearCooldownButtonTextMobile: {
    fontSize: 6.5,
  },

  // Select phase: footer (QuestPoints + Start)
  selectFooterBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectFooterXpText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  selectFooterQuitButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  selectFooterQuitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectFooterStartButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 118,
  },
  selectFooterStartText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Select phase: 3 chosen-slot cards
  selectSlotWrap: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 2,
    backgroundColor: 'transparent',
  },
  selectSlotPressable: {
    width: '100%',
    borderRadius: 12,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 118,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  selectSlotNumber: {
    fontWeight: '700',
    marginBottom: 0,
  },
  selectSlotIcon: {
    width: '100%',
    height: 60,
    opacity: 1,
  },
  selectSlotIconPlaceholder: {
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectSlotMeta: {
    marginTop: 0,
    alignItems: 'center',
    width: '100%',
  },
  selectSlotMetaName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectSlotMetaNameMobile: {
    fontSize: 7.15,
  },
  selectSlotMetaStats: {
    marginTop: 0,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  selectSlotMetaStatsMobile: {
    fontSize: 6.5,
  },
  selectSlotMetaHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#6B7280',
  },

  // Mobile battle layout
  mobileBattleContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mobileTopBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mobileTopBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  mobileNamesBlock: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mobileOpponentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  mobileUserName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#3B82F6',
    marginTop: 2,
  },
  mobilePauseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginLeft: 10,
  },
  mobilePauseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  mobileEnemySlotsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'transparent',
  },
  headerSlotContentWrap: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerSlotFaintedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(107,114,128,0.25)',
  },
  mobileSlotWrap: {
    backgroundColor: 'transparent',
    marginLeft: 8,
  },
  mobileSlotWrapSmall: {
    marginLeft: 6,
  },
  mobileSlotInner: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSlotInnerSmall: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  mobileSlotIcon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  mobileSlotIconSmall: {
    width: 38,
    height: 38,
  },
  mobileArena: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  mobileArenaContent: {
    flex: 1,
  },
  mobileArenaTopHalf: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  mobileArenaBottomHalf: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  mobileCombatCardTop: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignSelf: 'flex-end',
    width: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  mobileCombatCardTopSmall: {
    width: '92%',
    padding: 10,
  },
  mobileCombatCardBottom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignSelf: 'flex-start',
    width: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  mobileCombatCardBottomSmall: {
    width: '92%',
    padding: 10,
  },
  mobileCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 12,
  },
  mobileCardHeaderRowSmall: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  mobileCardName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  mobileCardNameSmall: {
    fontSize: 16,
  },
  mobileCardStats: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },
  mobileCardStatsSmall: {
    fontSize: 12,
  },
  mobileCardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 6,
    backgroundColor: 'transparent',
    gap: 8,
  },
  mobileHealthBarContainer: {
    width: '100%',
    height: 14,
    marginTop: 8,
  },
  mobileEmptyHealthBar: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  mobileHealthBar: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  mobileIconStage: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 130,
  },
  mobileIconStageSmall: {
    minHeight: 110,
  },
  mobileTapHint: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  mobileTapHintTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mobileTapHintSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  mobileBottomBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  mobileSpecialButton: {
    marginLeft: 12,
  },

  // Search / filter bar (same UI as Creatures tab)
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  clearFiltersText: {
    color: '#FF6B35',
    fontWeight: '600',
  },

  // Filter modal (same UI as Creatures tab)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#FFF5F1',
    borderColor: '#FF6B35',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  filterTwoColRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  filterCol: {
    flex: 1,
  },
  filterColLeft: {
    paddingRight: 14,
  },
  filterColRight: {
    paddingLeft: 14,
  },
  filterColDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E5E7EB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  resetButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },
  applyButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  // Header actions
  battleHeaderActionsRow: { flexDirection: 'row', alignItems: 'center' },
  battleHeaderPrimaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  battleHeaderPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  battleHeaderSecondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  battleHeaderSecondaryText: { color: '#6B7280', fontWeight: '800', fontSize: 13 },
  battleHeaderActionButtonWithMargin: { marginRight: 8 },

  // Select header creatures button
  selectHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  selectHeaderButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // Creatures modal chrome
  creaturesModalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  creaturesModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creaturesModalTitle: { fontSize: 18, fontWeight: '700' },
  creaturesModalCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#6B7280',
  },
  creaturesModalCloseText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  creaturesModalCountRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  creaturesModalCountText: { fontSize: 12, color: '#6B7280' },

  // Overlay cards / buttons
  overlayCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  overlayTitleMuted: { fontSize: 22, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  overlayBodyMuted: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },

  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  dangerButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  fullWidth: { width: '100%' },
  buttonWithBottomMargin: { marginBottom: 10 },

  // Common pressed states
  buttonPressed085: { opacity: 0.85 },
  buttonPressed07: { opacity: 0.7 },
});
