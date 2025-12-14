import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Image, View, Modal, Alert, ActivityIndicator, Platform } from 'react-native';
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
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// helper for awesome6 icons
function TabBarIcon6(props: {
  name: React.ComponentProps<typeof FontAwesome6>['name'];
  color: string;
  size?: number;
}) {
  return <FontAwesome6 size={props.size || 24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, signOut } = useAuth();
  const { isInstructor } = useInstructor(user?.uid);
  const [showPolarModal, setShowPolarModal] = useState(false);
  const [hasPolarToken, setHasPolarToken] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

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
      Alert.alert('Declined', 'Your Polar account has been disconnected. You can link it again anytime.');
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#636E72',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        // disable the static render of the header on web
        // prevent a hydration error in React Navigation v6 i think idk it breaks if i dont put it there
        headerShown: useClientOnlyValue(false, true),
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
        },
        headerLeft: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
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
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerTitle: 'QuestFit',
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
          tabBarIcon: ({ color }) => <TabBarIcon6 name="burst" color={color} />,
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
        name="me"
        options={{
          // href: null,
          title: 'Me',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon6 name="person" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="creatures"
        options={{
          // href: null,
          title: 'Creatures',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon name="gitlab" color={color} />,
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
        name="instr-dashboard.old"
        options={{
          href: null,
        }}
      />
    </Tabs>

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
