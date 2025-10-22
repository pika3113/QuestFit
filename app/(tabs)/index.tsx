import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { StatsDisplay } from '@/components/game/StatsDisplay';
import { WorkoutCard } from '@/components/fitness/WorkoutCard';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  
  // Use real user ID from authentication
  const userId = user?.uid || "demo-user";
  const { profile, loading } = useGameProfile(userId);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Mock recent workout data
  const mockWorkout = {
    id: '1',
    userId: userId,
    polarWorkoutId: 'polar-123',
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    calories: 420,
    distance: 5200, // 5.2km in meters
    duration: 45, // 45 minutes
    avgHeartRate: 152,
    maxHeartRate: 178,
    sport: 'RUNNING',
    gameRewards: {
      experienceGained: 85,
      creaturesFound: [
        {
          id: 'creature-1',
          name: 'Thunder Wolf',
          type: 'rare' as const,
          image: '',
          stats: { power: 85, speed: 92, endurance: 78 },
          requiredWorkout: { minCalories: 400, minDistance: 5000 }
        }
      ],
      questProgress: []
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Welcome to QuestFit!</Text>
          <Text style={styles.subtitle}>Transform your workouts into epic adventures</Text>
        </View>
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
      
      {profile && <StatsDisplay profile={profile} />}
      
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Workout</Text>
        <WorkoutCard session={mockWorkout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  headerContainer: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
  },
  headerContent: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'left',
    color: '#6B7280',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    marginTop: 12,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  recentSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 16,
    color: '#1F2937',
  },
});
