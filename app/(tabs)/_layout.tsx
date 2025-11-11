import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Tabs } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';


// built-in icon families and icons at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // disable the static render of the header on web
        // prevent a hydration error in React Navigation v6 i think idk it breaks if i dont put it there
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="Home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="fire" color={color} />,
        }}
      />
      <Tabs.Screen
        name="creature"
        options={{
          // href: null,
          title: 'Creatures',
          tabBarIcon: ({ color }) => <TabBarIcon name="gitlab" color={color} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          // href: null,
          title: 'Workout',
          tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
        }}
      />
      <Tabs.Screen
        name="multi-device"
        options={{
          title: 'Instr Dashboard',
          tabBarIcon: ({ color }) => <FontAwesome6 name="people-robbery" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="xp"
        options={{
          // href: null,
          title: 'Me',
          tabBarIcon: ({ color }) => <FontAwesome6 name="person" color={color} size={24}/>,
        }}
      />
      <Tabs.Screen
        name="test"
        options={{
          title: 'Test',
          tabBarIcon: ({ color }) => <TabBarIcon name="flask" color={color} />,
        }}
      />
    </Tabs>
  );
}
