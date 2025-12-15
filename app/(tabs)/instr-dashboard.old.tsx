import React, { useState, useEffect, useCallback, createElement } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/Themed';
import { useAuth } from '@/src/hooks/useAuth';
import { useInstructor } from '@/src/hooks/useInstructor';
import { useInstructorStudents } from '@/src/hooks/useInstructorStudents';
import { instructorDashboardStyles as styles } from '@/src/styles/screens/instructorDashboardStyles';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

import { useDashboardData } from '@/components/instr-dashboard/hooks/useDashboardData';
import { SleepScoreLineChart } from '@/components/instr-dashboard/components/SleepScoreLineChart';
import { SleepScoreBarChart } from '@/components/instr-dashboard/components/SleepScoreBarChart';
import { SleepScoreAreaChart } from '@/components/instr-dashboard/components/SleepScoreAreaChart';
import { SleepScoreScatterChart } from '@/components/instr-dashboard/components/SleepScoreScatterChart';
import { DailyStepsBarChart } from '@/components/instr-dashboard/components/DailyStepsBarChart';
import { DailyStepsLineChart } from '@/components/instr-dashboard/components/DailyStepsLineChart';
import { DailyStepsAreaChart } from '@/components/instr-dashboard/components/DailyStepsAreaChart';
import { DailyStepsScatterChart } from '@/components/instr-dashboard/components/DailyStepsScatterChart';
import { MonthlyExercisesBarChart } from '@/components/instr-dashboard/components/MonthlyExercisesBarChart';
import { MonthlyExercisesLineChart } from '@/components/instr-dashboard/components/MonthlyExercisesLineChart';
import { MonthlyExercisesAreaChart } from '@/components/instr-dashboard/components/MonthlyExercisesAreaChart';
import { MonthlyExercisesScatterChart } from '@/components/instr-dashboard/components/MonthlyExercisesScatterChart';
import { UserSelectionView } from '@/components/instr-dashboard/components/UserSelectionView';
import { UserFilterDropdown } from '@/components/instr-dashboard/components/UserFilterDropdown';
import { CHART_TYPE_KEY, STEPS_CHART_TYPE_KEY, EXERCISES_CHART_TYPE_KEY } from '@/app/instructor/settings';

import { db } from '@/src/services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { isInstructor, loading: instructorLoading } = useInstructor(user?.uid);
  const { selectedUserIds, loading: studentsLoading, toggleUser } = useInstructorStudents(user?.uid);
  
  const [refreshing, setRefreshing] = useState(false);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [filteredUserId, setFilteredUserId] = useState<string>('all'); // 'all' = show all users
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [sleepChartType, setSleepChartType] = useState<'line' | 'bar' | 'area' | 'scatter'>('line');
  const [stepsChartType, setStepsChartType] = useState<'line' | 'bar' | 'area' | 'scatter'>('bar');
  const [exercisesChartType, setExercisesChartType] = useState<'line' | 'bar' | 'area' | 'scatter'>('bar');

  const {
    allUsers,
    userOverviews,
    loadingOverviews,
    sleepScoreData,
    sleepDates,
    loadingSleepData,
    loadAllUsers,
    loadUserOverviews,
    loadSleepScoreData,
  } = useDashboardData(selectedUserIds, selectedDate);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        try {
          // 1. Try local storage first
          const savedSleepType = await AsyncStorage.getItem(CHART_TYPE_KEY);
          const savedStepsType = await AsyncStorage.getItem(STEPS_CHART_TYPE_KEY);
          const savedExercisesType = await AsyncStorage.getItem(EXERCISES_CHART_TYPE_KEY);

          if (['line', 'bar', 'area', 'scatter'].includes(savedSleepType || '')) setSleepChartType(savedSleepType as any);
          if (['line', 'bar', 'area', 'scatter'].includes(savedStepsType || '')) setStepsChartType(savedStepsType as any);
          if (['line', 'bar', 'area', 'scatter'].includes(savedExercisesType || '')) setExercisesChartType(savedExercisesType as any);

          // 2. Try server storage if user is logged in
          if (user?.uid) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              const settings = data.settings || {};
              
              if (settings.sleepChartType && ['line', 'bar', 'area', 'scatter'].includes(settings.sleepChartType)) {
                setSleepChartType(settings.sleepChartType);
                await AsyncStorage.setItem(CHART_TYPE_KEY, settings.sleepChartType);
              }
              if (settings.stepsChartType && ['line', 'bar', 'area', 'scatter'].includes(settings.stepsChartType)) {
                setStepsChartType(settings.stepsChartType);
                await AsyncStorage.setItem(STEPS_CHART_TYPE_KEY, settings.stepsChartType);
              }
              if (settings.exercisesChartType && ['line', 'bar', 'area', 'scatter'].includes(settings.exercisesChartType)) {
                setExercisesChartType(settings.exercisesChartType);
                await AsyncStorage.setItem(EXERCISES_CHART_TYPE_KEY, settings.exercisesChartType);
              }
            }
          }
        } catch (e) {
          console.error('Failed to load chart settings', e);
        }
      };
      loadSettings();
    }, [user])
  );

  useEffect(() => {
    if (isInstructor) {
      loadAllUsers();
    }
  }, [isInstructor, loadAllUsers]);

  useEffect(() => {
    if (selectedUserIds.length > 0) {
      loadUserOverviews();
      loadSleepScoreData();
    }
  }, [selectedUserIds, loadUserOverviews, loadSleepScoreData, selectedDate]);

  // Reset filter if the selected user is no longer in the list of students
  useEffect(() => {
    if (filteredUserId !== 'all' && !selectedUserIds.includes(filteredUserId)) {
      setFilteredUserId('all');
    }
  }, [selectedUserIds, filteredUserId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const users = await loadAllUsers();
    await loadUserOverviews(users);
    await loadSleepScoreData();
    setRefreshing(false);
  };

  const onChangeDate = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  // ============================================================
  // FILTERING LOGIC
  // ============================================================
  
  // Get the user IDs to display (respects filter)
  const getDisplayedUserIds = (): string[] => {
    if (filteredUserId === 'all') {
      return selectedUserIds; // Show all selected users
    }
    // Single user selected - check if they exist in selectedUserIds
    if (selectedUserIds.includes(filteredUserId)) {
      return [filteredUserId];
    }
    return selectedUserIds; // Fallback to all if filtered user not found
  };

  const displayedUserIds = getDisplayedUserIds();

  // Users available for filtering (only those that are selected for monitoring)
  const selectableUsers = allUsers.filter(u => selectedUserIds.includes(u.id));

  // Get the dynamic title
  const getDynamicTitle = (): string => {
    if (filteredUserId === 'all') {
      return 'Overview';
    }
    const foundUser = allUsers.find(u => u.id === filteredUserId);
    const displayName = foundUser?.displayName || filteredUserId;
    return `${displayName}'s Statistics`;
  };

  // Check if a single user is selected (not "all")
  const isSingleUserSelected = filteredUserId !== 'all';

  // Navigate to user detail page
  const handleViewDetails = () => {
    if (isSingleUserSelected) {
      router.push({
        pathname: '/instructor/user-detail',
        params: { 
          userId: filteredUserId,
          date: selectedDate.toISOString()
        }
      });
    }
  };

  // ============================================================
  // LOADING / ACCESS STATES
  // ============================================================

  if (instructorLoading || studentsLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isInstructor) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.subtitle}>
          This dashboard is only available for instructors.
        </Text>
      </View>
    );
  }

  if (showUserSelection) {
    return (
      <UserSelectionView
        allUsers={allUsers}
        selectedUserIds={selectedUserIds}
        onToggleUser={toggleUser}
        onDone={() => setShowUserSelection(false)}
      />
    );
  }

  // ============================================================
  // CHART DATA - USES displayedUserIds
  // ============================================================

  const chartData = displayedUserIds.map(userId => {
    const foundUser = allUsers.find(u => u.id === userId);
    const overview = userOverviews.get(userId);

    return {
      id: userId,
      name: foundUser?.displayName || userId,
      value: overview?.totalMonthExercises || 0,
    };
  }).sort((a, b) => b.value - a.value);

  const stepsChartData = displayedUserIds.map(userId => {
    const foundUser = allUsers.find(u => u.id === userId);
    const overview = userOverviews.get(userId);

    return {
      name: foundUser?.displayName || userId,
      steps: overview?.todayActivity?.steps || 0,
    };
  }).sort((a, b) => b.steps - a.steps);

  // Filter sleep data to only include displayed users (for individual lines)
  const filteredSleepData = new Map(
    Array.from(sleepScoreData.entries()).filter(([userId]) => 
      displayedUserIds.includes(userId)
    )
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
         <Text style={styles.title}>Instructor Dashboard</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {Platform.OS === 'web' ? (
            <View style={[styles.webDatePickerContainer, { cursor: 'pointer' } as any]}>
              <Text style={[styles.selectButtonText, { color: '#333' }]}>
                {String(selectedDate.getDate()).padStart(2, '0')}/{String(selectedDate.getMonth() + 1).padStart(2, '0')}/{selectedDate.getFullYear()}
              </Text>
              {/* @ts-ignore: Web-only input */}
              {createElement('input', {
                type: 'date',
                value: selectedDate.getFullYear() + '-' + String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + String(selectedDate.getDate()).padStart(2, '0'),
                onChange: (e: any) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    onChangeDate(null, date);
                  }
                },
                onClick: (e: any) => {
                  try {
                    if (e.target.showPicker) {
                      e.target.showPicker();
                    }
                  } catch (err) {
                    // ignore
                  }
                },
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 10,
                  border: 'none'
                }
              })}
            </View>
          ) : (
            <Pressable
              style={[styles.selectButton, { backgroundColor: '#f0f0f0' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.selectButtonText, { color: '#333' }]}>
                {formatDateDdMmYyyy(selectedDate)}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.selectButton}
            onPress={() => setShowUserSelection(true)}
          >
            <Text style={styles.selectButtonText}>
              {selectedUserIds.length > 0 ? 'Edit Users' : 'Select Users'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.selectButton, { backgroundColor: '#f0f0f0', width: 40, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => router.push('/instructor/settings')}
          >
            <Ionicons name="settings-outline" size={20} color="#333" />
          </Pressable>
        </View>
      </View>

      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      )}

      {selectedUserIds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No users selected. Tap "Select Users" to start monitoring.
          </Text>
        </View>
      ) : loadingOverviews ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      ) : (
        <View>
          {/* User Filter Dropdown */}
          <UserFilterDropdown
            allUsers={selectableUsers}
            selectedUserId={filteredUserId}
            onFilterChange={setFilteredUserId}
          />

          {/* Dynamic Title */}
          <Text style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: '#333',
            textAlign: 'center',
            marginBottom: isSingleUserSelected ? 8 : 20,
            marginTop: 8,
          }}>
            {getDynamicTitle()}
          </Text>

          {/* Tap to view details - only shown when single user is selected */}
          {isSingleUserSelected && (
            <Pressable 
              onPress={handleViewDetails}
              style={{
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{
                fontSize: 14,
                color: '#FF6B35',
                fontWeight: '500',
              }}>
                Tap to view details →
              </Text>
            </Pressable>
          )}

          {/* Daily Steps Chart */}
          {(() => {
            switch (stepsChartType) {
              case 'line':
                return <DailyStepsLineChart chartData={stepsChartData} date={selectedDate} />;
              case 'area':
                return <DailyStepsAreaChart chartData={stepsChartData} date={selectedDate} />;
              case 'scatter':
                return <DailyStepsScatterChart chartData={stepsChartData} date={selectedDate} />;
              case 'bar':
              default:
                return <DailyStepsBarChart chartData={stepsChartData} date={selectedDate} />;
            }
          })()}

          {/* Monthly Exercise Chart */}
          {(() => {
            const onUserPress = (userId: string) => {
              router.push({
                pathname: '/instructor/user-detail',
                params: { 
                  userId: userId,
                  date: selectedDate.toISOString()
                }
              });
            };

            switch (exercisesChartType) {
              case 'line':
                return <MonthlyExercisesLineChart chartData={chartData} onUserPress={onUserPress} />;
              case 'area':
                return <MonthlyExercisesAreaChart chartData={chartData} onUserPress={onUserPress} />;
              case 'scatter':
                return <MonthlyExercisesScatterChart chartData={chartData} onUserPress={onUserPress} />;
              case 'bar':
              default:
                return <MonthlyExercisesBarChart chartData={chartData} onUserPress={onUserPress} />;
            }
          })()}

          {/* View All Exercises Button */}
          <Pressable
            style={{
              backgroundColor: '#FF6B35',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 20,
              marginHorizontal: 16,
            }}
            onPress={() => {
              router.push({
                pathname: '/instructor/all-exercises',
                params: { 
                  userIds: displayedUserIds.join(','),
                  initialDate: selectedDate.toISOString()
                }
              });
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
              View All Exercises Details
            </Text>
          </Pressable>

          {/* Sleep Score Chart */}
          {loadingSleepData ? (
            <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={{ color: '#666', marginTop: 8, fontSize: 12 }}>Loading sleep data...</Text>
            </View>
          ) : (
            (() => {
              switch (sleepChartType) {
                case 'bar':
                  return (
                    <SleepScoreBarChart 
                      sleepData={filteredSleepData}
                      dates={sleepDates}
                      allUsers={allUsers}
                    />
                  );
                case 'area':
                  return (
                    <SleepScoreAreaChart 
                      sleepData={filteredSleepData}
                      dates={sleepDates}
                      allUsers={allUsers}
                    />
                  );
                case 'scatter':
                  return (
                    <SleepScoreScatterChart 
                      sleepData={filteredSleepData}
                      dates={sleepDates}
                      allUsers={allUsers}
                    />
                  );
                case 'line':
                default:
                  return (
                    <SleepScoreLineChart 
                      sleepData={filteredSleepData}      // Filtered data for individual lines
                      allSleepData={sleepScoreData}       // Full data for average calculation
                      dates={sleepDates}
                      allUsers={allUsers}
                    />
                  );
              }
            })()
          )}

          {/* View All Sleep Button */}
          <Pressable
            style={{
              backgroundColor: '#3F51B5',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 20,
              marginHorizontal: 16,
            }}
            onPress={() => {
              router.push({
                pathname: '/instructor/all-sleep',
                params: { 
                  userIds: displayedUserIds.join(','),
                  initialDate: selectedDate.toISOString()
                }
              });
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
              View All Sleep Details
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}