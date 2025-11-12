import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Image } from 'react-native';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/src/hooks/useAuth';


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
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // disable the static render of the header on web
        // prevent a hydration error in React Navigation v6 i think idk it breaks if i dont put it there
        headerShown: useClientOnlyValue(false, true),
        headerTitleAlign: 'center',
        headerLeft: () => (
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={styles.headerIcon}
            resizeMode="contain"
          />
        ),
        headerRight: () => (
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
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
        name="creatures"
        options={{
          // href: null,
          title: 'Creatures',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon name="gitlab" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          // href: null,
          title: 'Workout',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
        }}
      />
      <Tabs.Screen
        name="instr-dashboard"
        options={{
          title: 'Instr Dashboard',
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
        name="test"
        options={{
          title: 'Test',
          headerTitle: 'QuestFit',
          tabBarIcon: ({ color }) => <TabBarIcon name="flask" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    width: 32,
    height: 32,
    marginLeft: 16,
    borderRadius: 16,
  },
  signOutButton: {
    marginRight: 16,
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
