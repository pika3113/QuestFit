import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/Themed';

/**
 * OAuth callback route for Polar Flow
 * This handles the redirect from Polar with the authorization code
 * Route: questfit://oauth/polar?code=<authorization_code>
 */
export default function PolarOAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // The actual OAuth handling is done by expo-auth-session's startAsync
    // This route is just a placeholder for the redirect URI
    // The AuthSession automatically handles the callback and returns control
    // to the startAsync promise, so we just show a loading state briefly
    
    console.log('📱 OAuth callback route hit');
    console.log('Params:', params);

    // Redirect back to home after a brief moment
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 1000);

    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Completing authorization...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#AAAAAA',
  },
});
