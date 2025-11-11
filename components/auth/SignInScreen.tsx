import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { Picker } from '@react-native-picker/picker';
import { db } from '@/src/services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyAuthChange } from '@/src/hooks/useAuth';

// Predefined test users with fixed UIDs (stored locally)
const TEST_USERS = [
  { id: 'test1', label: 'Test User 1', uid: 'LOCAL_TEST_USER_1' },
  { id: 'test2', label: 'Test User 2', uid: 'LOCAL_TEST_USER_2' },
  { id: 'test3', label: 'Test User 3', uid: 'LOCAL_TEST_USER_3' },
  { id: 'test4', label: 'Test User 4', uid: 'LOCAL_TEST_USER_4' },
  { id: 'admin', label: 'Admin User', uid: 'LOCAL_ADMIN_USER' },
];

interface SignInScreenProps {
  onSignInSuccess?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState(TEST_USERS[0].id);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔵 Starting Sign In');
      console.log('Selected user:', selectedUser);

      const selectedUserData = TEST_USERS.find(u => u.id === selectedUser);
      
      if (!selectedUserData) {
        throw new Error('Invalid user selection');
      }

      // Store the selected user ID locally
      await AsyncStorage.setItem('CURRENT_TEST_USER', selectedUser);
      await AsyncStorage.setItem('CURRENT_TEST_USER_UID', selectedUserData.uid);
      
      console.log('✅ Signed in as:', selectedUserData.label, '(UID:', selectedUserData.uid, ')');
      
      // Check if user profile exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', selectedUserData.uid));
      if (!userDoc.exists()) {
        console.log('Creating new user profile...');
        try {
          await setDoc(doc(db, 'users', selectedUserData.uid), {
            userId: selectedUserData.uid,
            username: selectedUser,
            displayName: selectedUserData.label,
            level: 1,
            xp: 0,
            totalWorkouts: 0,
            totalCalories: 0,
            totalDistance: 0,
            capturedCreatures: [],
            achievements: [],
          });
          console.log('✅ User profile initialized');
        } catch (profileError) {
          console.warn('⚠️ Could not create user profile:', profileError);
        }
      } else {
        console.log('✅ User profile found');
      }
      
      // Notify auth change listeners
      notifyAuthChange();
      
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

        {/* User Selection Dropdown */}
        <View style={styles.userSelectionContainer}>
          <Text style={styles.userSelectionLabel}>Select User:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedUser}
              onValueChange={(itemValue: string) => setSelectedUser(itemValue)}
              style={styles.picker}
            >
              {TEST_USERS.map((user) => (
                <Picker.Item key={user.id} label={user.label} value={user.id} />
              ))}
            </Picker>
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
  userSelectionContainer: {
    marginVertical: 20,
  },
  userSelectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  picker: {
    color:'#ffffff',
    height: 56,
    marginVertical: -8,
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
