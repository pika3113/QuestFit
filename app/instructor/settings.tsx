import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/Colors';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const CHART_TYPE_KEY = 'instructor_sleep_chart_type';
export const STEPS_CHART_TYPE_KEY = 'instructor_steps_chart_type';
export const EXERCISES_CHART_TYPE_KEY = 'instructor_exercises_chart_type';

type ChartType = 'line' | 'bar' | 'area' | 'scatter';

export default function InstructorSettingsScreen() {
  const { user } = useAuth();
  const [sleepChartType, setSleepChartType] = useState<ChartType>('line');
  const [stepsChartType, setStepsChartType] = useState<ChartType>('bar');
  const [exercisesChartType, setExercisesChartType] = useState<ChartType>('bar');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      // 1. Try local storage first for speed
      const savedSleepType = await AsyncStorage.getItem(CHART_TYPE_KEY);
      const savedStepsType = await AsyncStorage.getItem(STEPS_CHART_TYPE_KEY);
      const savedExercisesType = await AsyncStorage.getItem(EXERCISES_CHART_TYPE_KEY);

      if (isValidType(savedSleepType)) setSleepChartType(savedSleepType as ChartType);
      if (isValidType(savedStepsType)) setStepsChartType(savedStepsType as ChartType);
      if (isValidType(savedExercisesType)) setExercisesChartType(savedExercisesType as ChartType);

      // 2. Try server storage if user is logged in
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const settings = data.settings || {};

          if (isValidType(settings.sleepChartType)) {
            setSleepChartType(settings.sleepChartType);
            await AsyncStorage.setItem(CHART_TYPE_KEY, settings.sleepChartType);
          }
          if (isValidType(settings.stepsChartType)) {
            setStepsChartType(settings.stepsChartType);
            await AsyncStorage.setItem(STEPS_CHART_TYPE_KEY, settings.stepsChartType);
          }
          if (isValidType(settings.exercisesChartType)) {
            setExercisesChartType(settings.exercisesChartType);
            await AsyncStorage.setItem(EXERCISES_CHART_TYPE_KEY, settings.exercisesChartType);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidType = (type: string | null): boolean => {
    return ['line', 'bar', 'area', 'scatter'].includes(type || '');
  };

  const saveSleepChartType = async (type: ChartType) => {
    try {
      setSleepChartType(type);
      await AsyncStorage.setItem(CHART_TYPE_KEY, type);
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), { settings: { sleepChartType: type } }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to save sleep settings', error);
    }
  };

  const saveStepsChartType = async (type: ChartType) => {
    try {
      setStepsChartType(type);
      await AsyncStorage.setItem(STEPS_CHART_TYPE_KEY, type);
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), { settings: { stepsChartType: type } }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to save steps settings', error);
    }
  };

  const saveExercisesChartType = async (type: ChartType) => {
    try {
      setExercisesChartType(type);
      await AsyncStorage.setItem(EXERCISES_CHART_TYPE_KEY, type);
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), { settings: { exercisesChartType: type } }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to save exercises settings', error);
    }
  };

  const renderToggle = (currentType: ChartType, onSelect: (t: ChartType) => void) => (
    <View style={styles.toggleContainer}>
      {(['line', 'bar', 'area', 'scatter'] as ChartType[]).map((type) => (
        <Pressable 
          key={type}
          style={[styles.toggleButton, currentType === type && styles.activeToggle]}
          onPress={() => onSelect(type)}
        >
          <Text style={[styles.toggleText, currentType === type && styles.activeToggleText]}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Instructor Settings' }} />
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dashboard Configuration</Text>
        
        {/* Steps Chart Setting */}
        <View style={styles.settingBlock}>
          <View style={styles.labelContainer}>
            <Text style={styles.settingLabel}>Steps Graph Type</Text>
            <Text style={styles.settingDescription}>Select how daily steps are visualized</Text>
          </View>
          {renderToggle(stepsChartType, saveStepsChartType)}
        </View>

        <View style={styles.divider} />

        {/* Exercises Chart Setting */}
        <View style={styles.settingBlock}>
          <View style={styles.labelContainer}>
            <Text style={styles.settingLabel}>Exercises Graph Type</Text>
            <Text style={styles.settingDescription}>Select how monthly exercises are visualized</Text>
          </View>
          {renderToggle(exercisesChartType, saveExercisesChartType)}
        </View>

        <View style={styles.divider} />

        {/* Sleep Chart Setting */}
        <View style={styles.settingBlock}>
          <View style={styles.labelContainer}>
            <Text style={styles.settingLabel}>Sleep Graph Type</Text>
            <Text style={styles.settingDescription}>Select how sleep data is visualized</Text>
          </View>
          {renderToggle(sleepChartType, saveSleepChartType)}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  settingBlock: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    justifyContent: 'space-between',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleText: {
    fontSize: 12,
    color: '#666',
  },
  activeToggleText: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  }
});
