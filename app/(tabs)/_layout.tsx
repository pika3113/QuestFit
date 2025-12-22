import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Tabs, usePathname } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Image,
  View,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/src/hooks/useAuth';
import { useInstructor } from '@/src/hooks/useInstructor';
import { PolarLinkScreen } from '@/components/auth/PolarLinkScreen';
import { ConsentModal } from '@/components/auth/ConsentModal';
import { polarOAuthService } from '@/src/services/polarOAuthService';


// built-in icon families and icons at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={20} style={{ marginBottom: 0, marginRight: 0 }} {...props} />;
}

// helper for awesome6 icons
function TabBarIcon6(props: {
  name: React.ComponentProps<typeof FontAwesome6>['name'];
  color: string;
  size?: number;
}) {
  return <FontAwesome6 size={props.size || 18} style={{ marginBottom: 0, marginRight: 0 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, signOut } = useAuth();
  const { isInstructor } = useInstructor(user?.uid);
  const [showPolarModal, setShowPolarModal] = useState(false);
  const [hasPolarToken, setHasPolarToken] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const lastTabStorageKey = user?.uid ? `LAST_TAB_PATH_${user.uid}` : 'LAST_TAB_PATH_ANON';

  // Some Android devices/gesture modes can report a very small/zero bottom inset.
  // Enforce a conservative minimum so the app tab bar never sits under the system nav/home bar.
  const minTabBarSafeAreaBottom = Platform.OS === 'ios'
    ? 34
    : Platform.OS === 'android'
      ? 34
      : 0;
  const tabBarSafeAreaBottom = Platform.OS === 'web' ? 0 : Math.max(insets.bottom, minTabBarSafeAreaBottom);
  // Reduce tab bar height ~20% while preserving safe-area bottom inset.
  const TAB_BAR_HEIGHT_SCALE = 0.68 * 0.8;
  const tabBarBaseHeight = Platform.OS === 'ios' ? 85 : 65;
  const tabBarHeight = tabBarBaseHeight * TAB_BAR_HEIGHT_SCALE + tabBarSafeAreaBottom;
  const tabBarPaddingTop = Platform.OS === 'web' ? 0 : Math.round(10 * TAB_BAR_HEIGHT_SCALE);

  const overlayAnim = React.useRef(new Animated.Value(0)).current;

  const isHomeTab = pathname === '/home' || pathname.endsWith('/home');

  useEffect(() => {
    // Close the overlay menu on navigation.
    setOverlayMenuOpen(false);
    overlayAnim.setValue(0);
  }, [pathname, overlayAnim]);

  useEffect(() => {
    // Remember the last non-battle tab so Battle's "Quit Battle" can return there.
    // Store canonical routes (/home, /workout, ...) to match Expo Router's typed paths.
    const isBattle = pathname === '/battle' || pathname.endsWith('/battle');
    if (isBattle) return;

    const tabName = pathname.startsWith('/') ? pathname.slice(1).split('/')[0] : pathname;
    const allowedTabs = new Set(['home', 'workout', 'creatures', 'me', 'instr-dashboard']);
    if (!allowedTabs.has(tabName)) return;

    const nextPath = `/${tabName}`;
    AsyncStorage.setItem(lastTabStorageKey, nextPath).catch(() => undefined);
  }, [pathname, lastTabStorageKey]);

  useEffect(() => {
    checkPolarToken();
  }, [user]);

  const checkPolarToken = async () => {
    if (user) {
      const hasToken = await polarOAuthService.hasAccessToken(user.uid);
      setHasPolarToken(hasToken);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const setOverlayMenuVisible = (visible: boolean) => {
    setOverlayMenuOpen(visible);
    Animated.timing(overlayAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleLinkPolar = async () => {
    if (!user) return;

    try {
      console.log('🔗 Starting Polar OAuth flow...');
      const result = await polarOAuthService.startOAuthFlow(user.uid);

      if (result) {
        console.log('✅ Polar account linked successfully!');
        setHasPolarToken(true);
        // Show consent modal instead of just an alert
        setShowConsentModal(true);
      } else {
        console.log('❌ Polar linking failed or was cancelled');
      }
    } catch (error) {
      console.error('Error linking Polar account:', error);
      Alert.alert('Error', 'Failed to link Polar account. Please try again.');
    }
  };

  const handleConsentAccept = async () => {
    if (!user) return;
    try {
      setConsentLoading(true);
      await polarOAuthService.setConsentGiven(user.uid);
      setShowConsentModal(false);
      Alert.alert('Success', 'Your consent has been recorded and Polar account is linked!');
    } catch (error) {
      console.error('Error recording consent:', error);
      Alert.alert('Error', 'Failed to record consent. Please try again.');
    } finally {
      setConsentLoading(false);
    }
  };

  const handleConsentDecline = async () => {
    if (!user) return;
    try {
      setConsentLoading(true);
      await polarOAuthService.disconnectPolarAccount(user.uid);
      setHasPolarToken(false);
      setShowConsentModal(false);
      Alert.alert(
        'Declined',
        'Your Polar account has been disconnected. You can link it again anytime.'
      );
    } catch (error) {
      console.error('Error declining consent:', error);
      Alert.alert('Error', 'Failed to process your request. Please try again.');
    } finally {
      setConsentLoading(false);
    }
  };

  const handlePolarLinkSuccess = () => {
    setShowPolarModal(false);
    checkPolarToken();
  };

  const handlePolarLinkSkip = () => {
    setShowPolarModal(false);
  };

  const handleDisconnectPolar = async () => {
    if (!user) return;
    
    try {
      await polarOAuthService.disconnectPolarAccount(user.uid);
      setHasPolarToken(false);
      console.log('Polar account disconnected');
    } catch (error) {
      console.error('Error disconnecting Polar:', error);
    }
  };

  return (
    <>
    <View style={styles.root}>
      <Tabs
        screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#636E72',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'web' ? 0 : tabBarSafeAreaBottom,
          paddingTop: tabBarPaddingTop,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarItemStyle: Platform.OS === 'web'
          ? {
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: 0,
            }
          : undefined,
        tabBarIconStyle: Platform.OS === 'web'
          ? {
              marginTop: 0,
              marginBottom: 0,
            }
          : undefined,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: Platform.OS === 'web' ? 0 : undefined,
          marginBottom: Platform.OS === 'web' ? 0 : undefined,
          paddingTop: Platform.OS === 'web' ? 0 : undefined,
        },
        // Hide the QuestFit header globally; we only show it on the Home tab tbh
        headerShown: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#FFFFFF',
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          textAlign: 'center',
          color: '#000000',
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerTitle: 'QuestFit',
          // On web, avoid header hydration issues by only showing on client.
          headerShown: useClientOnlyValue(false, true),
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16, marginTop: 0 }}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={{ width: 32, height: 32, borderRadius: 16 }}
                resizeMode="contain"
              />
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          ),
          tabBarIcon: ({ color }) => <TabBarIcon name="fire" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          // Workout is the real route (used to be multi-device).
          title: 'Workout',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
        }}
      />
      <Tabs.Screen
        name="battle"
        options={{
          // href: null,
          title: 'Battle',
          headerTitle: 'QuestFit',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => <TabBarIcon6 name="burst" color={color} />,
        }}
      />
      <Tabs.Screen
        name="creatures"
        options={{
          title: 'Creatures',
          headerTitle: 'QuestFit',
          href:null,
          tabBarIcon: ({ color }) => <TabBarIcon name="gitlab" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          // href: null,
          title: 'Me',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon6 name="person" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="instr-dashboard"
        options={{
          href: isInstructor ? '/instr-dashboard' : null,
          title: 'Instructor',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon6 name="chalkboard-user" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="multi-device"
        options={{
          // Keep this screen mounted in tabs but real URL is /workout.
          href: null,
          title: 'Multi-Device (Legacy)',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon6 name="people-robbery" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="instr-dashboard.old"
        options={{
          href: null,
        }}
      />
      </Tabs>

      {!isHomeTab && (
        <>
          {overlayMenuOpen && (
            <Pressable style={styles.overlayDismissLayer} onPress={() => setOverlayMenuVisible(false)} />
          )}

          <View pointerEvents="box-none" style={[styles.logoOverlay, { top: insets.top + 16 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="QuestFit menu"
              onPress={() => setOverlayMenuVisible(!overlayMenuOpen)}
              style={styles.logoOverlayButton}
              hitSlop={8}
            >
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoOverlayImage}
                resizeMode="contain"
              />
            </Pressable>

            <Animated.View
              pointerEvents={overlayMenuOpen ? 'auto' : 'none'}
              style={[
                styles.logoOverlayMenu,
                {
                  opacity: overlayAnim,
                  transform: [
                    {
                      translateY: overlayAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 8],
                      }),
                    },
                    {
                      scaleY: overlayAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                style={[styles.signOutButton, styles.logoOverlaySignOutButton]}
                onPress={async () => {
                  setOverlayMenuVisible(false);
                  await handleSignOut();
                }}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </Animated.View>
          </View>
        </>
      )}
    </View>

    {/* Polar Link Modal */}
    <Modal
      visible={showPolarModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowPolarModal(false)}
    >
      {user && (
        <PolarLinkScreen
          userId={user.uid}
          onLinkSuccess={handlePolarLinkSuccess}
          onSkip={handlePolarLinkSkip}
        />
      )}
    </Modal>

    {/* Consent Modal */}
    <ConsentModal
      visible={showConsentModal}
      onConsent={handleConsentAccept}
      onDecline={handleConsentDecline}
      loading={consentLoading}
    />
  </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlayDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
  },
  logoOverlay: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    alignItems: 'flex-start',
  },
  logoOverlayButton: {
    alignSelf: 'flex-start',
  },
  logoOverlayImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  logoOverlayMenu: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
  logoOverlaySignOutButton: {
    borderRadius: 10,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  polarButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  polarButtonConnected: {
    backgroundColor: '#EF4444',
  },
  polarButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
