import React, { useState, useEffect } from 'react';
import { ScrollView, Pressable, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { xpStyles as styles } from '@/src/styles';
import { Creature } from '@/src/types/polar';
import creatureService from '@/src/services/creatureService';

interface WorkoutHistoryItem {
  sessionId: string;
  date: Date;
  xpEarned: number;
  sport: string;
}

export default function XPManagementScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [currentXP, setCurrentXP] = useState<number>(0);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryItem[]>([]);
  const [capturedCreatures, setCapturedCreatures] = useState<Creature[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
  const [totalCalories, setTotalCalories] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [totalAvgHeartRate, setTotalAvgHeartRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [xpAmount, setXpAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (user && !hasLoadedOnce) {
      loadUserXP();
      setHasLoadedOnce(true);
    }
  }, [user]);

  const loadUserXP = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setError('No user logged in');
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setCurrentXP(data.xp || 0);
        setCurrentLevel(data.level || 1);
        setTotalWorkouts(data.totalWorkouts || 0);
        setTotalCalories(data.totalCalories || 0);
        setTotalDuration(data.totalDuration || 0);
        setTotalAvgHeartRate(data.totalAvgHeartRate || 0);
        
        // Load full creature data from IDs
        const creatureIds = data.capturedCreatures || [];
        const creatures = creatureIds
          .map((id: string) => creatureService.getCreatureById(id))
          .filter((c: Creature | null) => c !== null) as Creature[];
        setCapturedCreatures(creatures);
        
        // Load workout history (most recent 10)
        const history = data.workoutHistory || [];
        const sortedHistory = history
          .map((item: any) => ({
            ...item,
            date: item.date?.toDate ? item.date.toDate() : new Date(item.date)
          }))
          .sort((a: WorkoutHistoryItem, b: WorkoutHistoryItem) => 
            b.date.getTime() - a.date.getTime()
          )
          .slice(0, 10);
        setWorkoutHistory(sortedHistory);
      } else {
        // Create user document if it doesn't exist
        await setDoc(userDocRef, { 
          xp: 0, 
          level: 1,
          totalWorkouts: 0,
          totalCalories: 0,
          workoutHistory: []
        });
        setCurrentXP(0);
        setCurrentLevel(1);
        setTotalWorkouts(0);
        setTotalCalories(0);
        setTotalDuration(0);
        setTotalAvgHeartRate(0);
        setWorkoutHistory([]);
        setCapturedCreatures([]);
      }
    } catch (err) {
      console.error('Failed to load XP:', err);
      setError(err instanceof Error ? err.message : 'Failed to load XP');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (type: Creature['type']) => {
    switch (type) {
      case 'common': return '#9CA3AF';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
      default: return '#9CA3AF';
    }
  };

  const updateXP = async (amount: number) => {
    try {
      setUpdating(true);
      setError(null);

      if (!user) {
        setError('No user logged in');
        return;
      }

      const newXP = Math.max(0, currentXP + amount); // Prevent negative XP

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { xp: newXP });

      setCurrentXP(newXP);
      setXpAmount('');

      Alert.alert(
        'Success!',
        `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} XP\nNew total: ${newXP} XP`
      );
    } catch (err) {
      console.error('Failed to update XP:', err);
      setError(err instanceof Error ? err.message : 'Failed to update XP');
      Alert.alert('Error', 'Failed to update XP. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddXP = () => {
    const amount = parseInt(xpAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number');
      return;
    }
    updateXP(amount);
  };

  const handleRemoveXP = () => {
    const amount = parseInt(xpAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number');
      return;
    }
    updateXP(-amount);
  };

  const handleQuickAdd = (amount: number) => {
    updateXP(amount);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'dark'].tint} />
        <Text style={styles.loadingText}>Loading XP...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>XP Management</Text>
        <Text style={styles.subtitle}>Manage your experience points</Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Pressable onPress={loadUserXP} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Current XP Display */}
      <View style={styles.xpDisplaySection}>
        <Text style={styles.xpLabel}>Level {currentLevel}</Text>
        <View style={styles.xpDisplay}>
          <Text style={styles.xpValue}>{currentXP}</Text>
          <Text style={styles.xpUnit}>XP</Text>
          <Text style={styles.xpIcon}>⭐</Text>
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Next level at {currentLevel * 100} XP ({Math.max(0, currentLevel * 100 - currentXP)} XP to go)
          </Text>
        </View>
        <Pressable onPress={loadUserXP} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
        </Pressable>
      </View>

      {/* Stats Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{currentLevel}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.round(totalDuration)}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.round(totalAvgHeartRate)}</Text>
            <Text style={styles.statLabel}>Avg HR</Text>
          </View>
        </View>
      </View>

      {/* Captured Creatures */}
      {capturedCreatures.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Captured Creatures ({capturedCreatures.length})</Text>
          <View style={styles.creaturesGrid}>
            {capturedCreatures.map((creature, index) => (
              <View 
                key={`${creature.id}-${index}`} 
                style={[
                  styles.creatureCard,
                  { borderLeftColor: getRarityColor(creature.type) }
                ]}
              >
                <Text style={styles.creatureName}>{creature.name}</Text>
                <Text style={[styles.creatureRarity, { color: getRarityColor(creature.type) }]}>
                  {creature.type.toUpperCase()}
                </Text>
                <View style={styles.creatureStats}>
                  <Text style={styles.creatureStat}>⚔️ {creature.stats.power}</Text>
                  <Text style={styles.creatureStat}>⚡ {creature.stats.speed}</Text>
                  <Text style={styles.creatureStat}>💪 {creature.stats.endurance}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Workout History */}
      {workoutHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {workoutHistory.map((item, index) => (
            <View key={`${item.sessionId}-${index}`} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyDate}>
                  {item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.historySport}>{item.sport}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyXP}>+{item.xpEarned} XP</Text>
              </View>
           s</View>
          ))}
        </View>
      )}

      {/* Manual XP Input
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add/Remove XP</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter XP amount"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          value={xpAmount}
          onChangeText={setXpAmount}
          editable={!updating}
        />

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, styles.addButton, updating && styles.buttonDisabled]}
            onPress={handleAddXP}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>➕ Add XP</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.removeButton, updating && styles.buttonDisabled]}
            onPress={handleRemoveXP}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>➖ Remove XP</Text>
            )}
          </Pressable>
        </View>
      </View> */}

      {/* Quick Add Buttons */}
      {/* <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <View style={styles.quickAddGrid}>
          {[10, 25, 50, 100, 250, 500].map((amount) => (
            <Pressable
              key={amount}
              style={[styles.quickAddButton, updating && styles.buttonDisabled]}
              onPress={() => handleQuickAdd(amount)}
              disabled={updating}
            >
              <Text style={styles.quickAddButtonText}>+{amount}</Text>
            </Pressable>
          ))}
        </View>
      </View> */}

      {/* XP Guide */}
      <View style={styles.section}>
        <Text style={styles.guideTitle}>💡 XP Guide</Text>
        <Text style={styles.guideText}>• Complete workouts to earn XP</Text>
        <Text style={styles.guideText}>• Use XP to level up your creatures</Text>
        <Text style={styles.guideText}>• Higher intensity = more XP earned</Text>
        <Text style={styles.guideText}>• Track your progress over time</Text>
      </View>

      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <Text style={styles.infoText}>User ID: {user?.uid.slice(0, 20)}...</Text>
        <Text style={styles.infoText}>
          Status: {user ? '✅ Logged In' : '❌ Not Logged In'}
        </Text>
        <Text style={styles.infoText}>
          Username: {user?.displayName || 'N/A'}
        </Text>
      </View>
    </ScrollView>
  );
}
