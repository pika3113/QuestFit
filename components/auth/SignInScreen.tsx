import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/src/services/firebase';

interface SignInScreenProps {
  onSignInSuccess?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔵 Starting Sign In');
      console.log('Auth object:', !!auth);
      console.log('Auth config:', auth?.config);

      // Sign in anonymously (for Expo Go testing)
      // In production, you'll replace this with proper Google OAuth
      const result = await signInAnonymously(auth);
      
      console.log('✅ Signed in anonymously:', result.user.uid);
      console.log('✅ User object:', {
        uid: result.user.uid,
        isAnonymous: result.user.isAnonymous,
        email: result.user.email
      });
      onSignInSuccess?.();
    } catch (err: any) {
      console.error('🔴 Full error object:', err);
      console.error('Error code:', err?.code);
      console.error('Error message:', err?.message);
      
      // Check if it's a configuration error
      if (err?.code === 'auth/configuration-not-found') {
        setError('Firebase not configured. Please enable Anonymous Auth in Firebase Console: Project Settings → Authentication → Sign-in method → Anonymous');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>QuestFit</Text>
          <Text style={styles.tagline}>Transform Your Fitness Into An Adventure</Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🏃</Text>
            <Text style={styles.featureText}>Track workouts from your Polar Watch</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🎯</Text>
            <Text style={styles.featureText}>Catch virtual creatures</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>⭐</Text>
            <Text style={styles.featureText}>Level up and unlock rewards</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🏆</Text>
            <Text style={styles.featureText}>Earn achievements</Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Sign In Button */}
        <Pressable
          style={[styles.signInButton, loading && styles.signInButtonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>�</Text>
              <Text style={styles.signInText}>Get Started</Text>
            </>
          )}
        </Pressable>

        {/* Terms */}
        <Text style={styles.termsText}>
          By signing in, you agree to our Terms of Service
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  featuresContainer: {
    marginVertical: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    fontSize: 20,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
  },
});
