import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/src/hooks/useAuth';
import { SignInScreen } from '@/components/auth/SignInScreen';
import { View, ActivityIndicator, Text as RNText, TextInput as RNTextInput } from 'react-native';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: Platform.OS === 'web' ? 'index' : '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function TRootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Apply a single global font across the app (web + native)
  useEffect(() => {
    if (!loaded) return;

    const fontFamily = 'SpaceMono';

    const mergeDefaultStyle = (existing: any) => {
      const base = { fontFamily };
      if (!existing) return [base];
      return Array.isArray(existing) ? [base, ...existing] : [base, existing];
    };

    // Text
    // @ts-expect-error defaultProps exists at runtime
    RNText.defaultProps = RNText.defaultProps || {};
    // @ts-expect-error defaultProps exists at runtime
    RNText.defaultProps.style = mergeDefaultStyle(RNText.defaultProps.style);

    // TextInput
    // @ts-expect-error defaultProps exists at runtime
    RNTextInput.defaultProps = RNTextInput.defaultProps || {};
    // @ts-expect-error defaultProps exists at runtime
    RNTextInput.defaultProps.style = mergeDefaultStyle(RNTextInput.defaultProps.style);
  }, [loaded]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    document.title = 'QuestFit';
  }, [pathname]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Show sign-in screen if not authenticated
  if (!user) {
    return <SignInScreen onSignInSuccess={() => {
      // Auth state will update automatically via notifyAuthChange
      // which is called from SignInScreen
    }} />;
  }

  // Show main app if authenticated
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="light" backgroundColor="#000000" />

        {/* Black underlay for the notch / status-bar safe-area */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#000000', zIndex: 9999 }}
        />

        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ headerShown: false }} />
          <Stack.Screen name="me-exercises" options={{ headerShown: false }} />
          <Stack.Screen name="instructor" options={{ headerShown: false }} />
        </Stack>
        {Platform.OS === 'web' && (
          <>
            {/* @ts-ignore - Dynamic import for web only */}
            {typeof window !== 'undefined' && (() => {
              const { Analytics } = require('@vercel/analytics/react');
              return <Analytics />;
            })()}
          </>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
