import { Stack } from 'expo-router';

export default function InstructorLayout() {
  return (
    <Stack>
      <Stack.Screen name="user-detail" options={{ headerShown: false }} />
      <Stack.Screen name="all-exercises" options={{ title: 'All Exercises' }} />
      <Stack.Screen name="all-sleep" options={{ title: 'All Sleep Data' }} />
      <Stack.Screen name="settings" options={{ title: 'Instructor Settings' }} />
    </Stack>
  );
}
