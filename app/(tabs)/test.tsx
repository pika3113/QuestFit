import React, { useState } from 'react';
import { ScrollView, Pressable, ActivityIndicator, Alert, TextInput, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/src/hooks/useAuth';
import workoutCompletionService from '@/src/services/workoutCompletionService';
import creatureService from '@/src/services/creatureService';
import { CreatureUnlockModal } from '@/components/game/CreatureUnlockModal';
import { Creature } from '@/src/types/polar';
import { StyleSheet } from 'react-native';

export default function TestScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [unlockedCreatures, setUnlockedCreatures] = useState<Creature[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Test workout parameters
  const [calories, setCalories] = useState('400');
  const [duration, setDuration] = useState('30');
  const [avgHeartRate, setAvgHeartRate] = useState('145');
  const [sport, setSport] = useState('RUNNING');

  // Quick test scenarios
  const scenarios = [
    {
      name: 'Easy Cycling',
      description: 'Should unlock Wind Falcon',
      params: { calories: 300, duration: 25, avgHeartRate: 140, sport: 'CYCLING' }
    },
    {
      name: 'Moderate Run',
      description: 'Should unlock Thunder Wolf',
      params: { calories: 400, duration: 30, avgHeartRate: 145, sport: 'RUNNING' }
    },
    {
      name: 'Intense Run',
      description: 'Should unlock Shadow Panther',
      params: { calories: 450, duration: 40, avgHeartRate: 150, sport: 'RUNNING' }
    },
    {
      name: 'Swimming Session',
      description: 'Should unlock Aqua Serpent',
      params: { calories: 200, duration: 30, avgHeartRate: 120, sport: 'SWIMMING' }
    },
    {
      name: 'Hiking Trip',
      description: 'Should unlock Forest Spirit',
      params: { calories: 250, duration: 45, avgHeartRate: 115, sport: 'HIKING' }
    },
    {
      name: 'Epic Workout',
      description: 'Should unlock Flame Phoenix',
      params: { calories: 600, duration: 60, avgHeartRate: 155, sport: 'FITNESS' }
    },
    {
      name: 'Ultra Session',
      description: 'Should unlock Golden Dragon',
      params: { calories: 1000, duration: 90, avgHeartRate: 160, sport: 'RUNNING' }
    },
  ];

  const testWorkout = async (testParams?: any) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const workoutParams = testParams || {
        calories: parseInt(calories),
        duration: parseInt(duration),
        avgHeartRate: parseInt(avgHeartRate),
        sport: sport
      };

      console.log('Testing workout with params:', workoutParams);

      // Check what creatures would be unlocked (preview)
      const profile = await import('@/src/services/gameService').then(m => m.default.getUserProfile(user.uid));
      const capturedIds = profile?.capturedCreatures || [];
      
      console.log('Already captured creature IDs:', capturedIds);
      console.log('Total captured:', capturedIds.length);
      
      const potentialUnlocks = creatureService.checkWorkoutForUnlocks(
        workoutParams,
        capturedIds
      );

      console.log('Potential unlocks:', potentialUnlocks);
      console.log('Number of unlocks:', potentialUnlocks.length);

      // Process the workout
      const result = await workoutCompletionService.completeLiveWorkout(
        user.uid,
        {
          duration: workoutParams.duration * 60, // convert to seconds
          averageHeartRate: workoutParams.avgHeartRate,
          maxHeartRate: workoutParams.avgHeartRate + 15,
          minHeartRate: workoutParams.avgHeartRate - 10,
          caloriesBurned: workoutParams.calories,
          currentZone: 3
        },
        workoutParams.sport
      );

      setLastResult(result);

      if (result.unlockedCreatures.length > 0) {
        setUnlockedCreatures(result.unlockedCreatures);
        setShowUnlockModal(true);
      }

      const summary = workoutCompletionService.getWorkoutSummary(result);
      Alert.alert('Test Complete!', summary);

    } catch (error) {
      console.error('Test error:', error);
      Alert.alert('Test Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runScenario = (scenario: any) => {
    Alert.alert(
      scenario.name,
      scenario.description + '\n\nRun this test?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run Test', onPress: () => testWorkout(scenario.params) }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Test Lab</Text>
        <Text style={styles.subtitle}>Test creature unlocks and XP gains</Text>
      </View>

      {!user && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Please sign in to test</Text>
        </View>
      )}

      {/* Quick Test Scenarios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Test Scenarios</Text>
        <Text style={styles.helperText}>Tap to run pre-configured workout tests</Text>
        
        {scenarios.map((scenario, index) => (
          <Pressable
            key={index}
            style={styles.scenarioButton}
            onPress={() => runScenario(scenario)}
            disabled={loading || !user}
          >
            <View style={styles.scenarioContent}>
              <Text style={styles.scenarioName}>{scenario.name}</Text>
              <Text style={styles.scenarioDescription}>{scenario.description}</Text>
              <Text style={styles.scenarioParams}>
                {scenario.params.calories} cal • {scenario.params.duration} min • {scenario.params.sport}
              </Text>
            </View>
            <Text style={styles.scenarioArrow}>→</Text>
          </Pressable>
        ))}
      </View>

      {/* Custom Workout Test */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Workout Test</Text>
        <Text style={styles.helperText}>Enter workout parameters manually</Text>

        <Text style={styles.label}>Calories</Text>
        <TextInput
          style={styles.input}
          placeholder="400"
          keyboardType="numeric"
          value={calories}
          onChangeText={setCalories}
          editable={!loading}
        />

        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="30"
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
          editable={!loading}
        />

        <Text style={styles.label}>Average Heart Rate</Text>
        <TextInput
          style={styles.input}
          placeholder="145"
          keyboardType="numeric"
          value={avgHeartRate}
          onChangeText={setAvgHeartRate}
          editable={!loading}
        />

        <Text style={styles.label}>Sport Type</Text>
        <View style={styles.sportGrid}>
          {['RUNNING', 'CYCLING', 'SWIMMING', 'HIKING', 'FITNESS'].map((sportType) => (
            <Pressable
              key={sportType}
              style={[
                styles.sportButton,
                sport === sportType && styles.sportButtonActive
              ]}
              onPress={() => setSport(sportType)}
              disabled={loading}
            >
              <Text style={[
                styles.sportButtonText,
                sport === sportType && styles.sportButtonTextActive
              ]}>
                {sportType}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.actionButton, styles.testButton, (loading || !user) && styles.buttonDisabled]}
          onPress={() => testWorkout()}
          disabled={loading || !user}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>🧪 Run Test Workout</Text>
          )}
        </Pressable>
      </View>

      {/* Last Test Result */}
      {lastResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Test Result</Text>
          <View style={styles.resultBox}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Base XP:</Text>
              <Text style={styles.resultValue}>{lastResult.baseXP}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Bonus XP:</Text>
              <Text style={styles.resultValue}>+{lastResult.bonusXP}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Total XP:</Text>
              <Text style={[styles.resultValue, styles.resultTotal]}>{lastResult.totalXP}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Creatures Unlocked:</Text>
              <Text style={styles.resultValue}>{lastResult.unlockedCreatures.length}</Text>
            </View>
            {lastResult.unlockedCreatures.length > 0 && (
              <View style={styles.creatureList}>
                {lastResult.unlockedCreatures.map((creature: Creature, index: number) => (
                  <Text key={index} style={styles.creatureName}>
                    • {creature.name} ({creature.type})
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.infoTitle}>💡 Testing Tips</Text>
        <Text style={styles.infoText}>• Use quick scenarios to test specific creatures</Text>
        <Text style={styles.infoText}>• Custom test allows fine-tuning parameters</Text>
        <Text style={styles.infoText}>• Each test creates a real workout in Firebase</Text>
        <Text style={styles.infoText}>• Check XP and Creatures tabs to verify results</Text>
        <Text style={styles.infoText}>• Unlocks based on calories, duration, and sport type</Text>
      </View>

      {/* Creature Unlock Modal */}
      <CreatureUnlockModal
        visible={showUnlockModal}
        creatures={unlockedCreatures}
        onClose={() => {
          setShowUnlockModal(false);
          setUnlockedCreatures([]);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1F2937',
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
  },
  scenarioButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scenarioContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  scenarioDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  scenarioParams: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  scenarioArrow: {
    fontSize: 20,
    color: '#3B82F6',
    marginLeft: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  sportButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sportButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  sportButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  sportButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    backgroundColor: '#8B5CF6',
  },
  testButton: {
    backgroundColor: '#10B981',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultTotal: {
    fontSize: 20,
    color: '#10B981',
  },
  creatureList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  creatureName: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    paddingLeft: 8,
  },
});
