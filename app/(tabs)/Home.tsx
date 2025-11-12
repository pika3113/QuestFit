import { ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { StatsDisplay } from '@/components/game/StatsDisplay';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { indexStyles as styles } from '@/src/styles';

export default function HomeScreen() {
  const { user } = useAuth();
  
  // use user ID from "authentication"
  const userId = user?.uid || "demo-user";
  const { profile, loading } = useGameProfile(userId);

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
          <Text style={styles.title}>Welcome to QuestFit, {user?.displayName || 'User'}!</Text>
          <Text style={styles.subtitle}>Transform your workouts into epic adventures</Text>
        </View>
      </View>
      
      {profile && <StatsDisplay profile={profile} />}
    </ScrollView>
  );
}
