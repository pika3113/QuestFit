import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/Themed';
import { useAuth } from '@/src/hooks/useAuth';
import { useInstructor } from '@/src/hooks/useInstructor';
import { useInstructorStudents } from '@/src/hooks/useInstructorStudents';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/src/services/firebase';
import { collection, getDocs, doc, getDoc, limit, orderBy, query } from 'firebase/firestore';
import { StudentCard, StudentStats, ChartType } from '@/components/instr-dashboard/StudentCard';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function InstructorDashboard() {
  const { width: windowWidth } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 900;

  const { user } = useAuth();
  const { isInstructor, loading: instructorLoading } = useInstructor(user?.uid);
  const { selectedUserIds, toggleUser } = useInstructorStudents(user?.uid);
  
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtering & Selection State
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date; type: '7d' | '14d' | '30d' | 'custom' }>({
    start: new Date(new Date().setDate(new Date().getDate() - 6)), // 7 days including today
    end: new Date(),
    type: '7d'
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Chart Configuration State
  const [chartConfig, setChartConfig] = useState<Record<'hr' | 'distance' | 'sleep' | 'calories', ChartType>>({
    hr: 'line',
    distance: 'bar',
    sleep: 'line',
    calories: 'area'
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedConfig = await AsyncStorage.getItem('instructor_chart_config');
        if (savedConfig) {
          setChartConfig(JSON.parse(savedConfig));
        }
      } catch (e) {
        console.error('Failed to load data', e);
      }
    };
    loadData();
  }, []);

  // Save chart config whenever it changes
  useEffect(() => {
    const saveConfig = async () => {
      try {
        await AsyncStorage.setItem('instructor_chart_config', JSON.stringify(chartConfig));
      } catch (e) {
        console.error('Failed to save chart config', e);
      }
    };
    saveConfig();
  }, [chartConfig]);

  const fetchStudentsData = useCallback(async (range = dateRange) => {
    try {
      // 1. Fetch all users (In a real app, you might filter by class/instructor)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const studentsData = await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // 2. Fetch recent exercises
          const hrHistory: number[] = [];
          const distanceHistory: number[] = [];
          const caloriesHistory: number[] = [];
          const sleepHistory: number[] = []; // Placeholder for now
          
          let lastSync: string | undefined = userData.lastSync;
          
          const datesToCheck: string[] = [];
          const current = new Date(range.start);
          const end = new Date(range.end);
          
          // Normalize to start of day
          current.setHours(0,0,0,0);
          end.setHours(23,59,59,999);

          while (current <= end) {
            datesToCheck.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
          }

          const [exercisesDocs, sleepDocs, activityDocs] = await Promise.all([
            Promise.all(datesToCheck.map(date =>
              getDoc(doc(db, `users/${userId}/polarData/exercises/all/${date}`))
            )),
            Promise.all(datesToCheck.map(date =>
              getDoc(doc(db, `users/${userId}/polarData/sleep/all/${date}`))
            )),
            Promise.all(datesToCheck.map(date =>
              getDoc(doc(db, `users/${userId}/polarData/activities/all/${date}`))
            )),
          ]);

          datesToCheck.forEach((_, index) => {
            const exercisesSnap = exercisesDocs[index];
            const activitySnap = activityDocs[index];

            // HR comes from exercises (best source)
            let dayHrSum = 0;
            let dayHrCount = 0;

            // Distance/Calories prefer activities (more consistently present), fallback to exercises
            let dayDist = 0;
            let dayCals = 0;

            if (activitySnap?.exists()) {
              const a = activitySnap.data();
              const distMeters =
                typeof a?.distance_from_steps === 'number'
                  ? a.distance_from_steps
                  : typeof a?.activity?.distanceMeters === 'number'
                    ? a.activity.distanceMeters
                    : null;

              if (distMeters != null) {
                // StudentCard labels this as Distance (m)
                dayDist = Math.round(distMeters);
              }

              if (typeof a?.calories === 'number') {
                dayCals = Math.round(a.calories);
              } else if (typeof a?.active_calories === 'number') {
                dayCals = Math.round(a.active_calories);
              }
            }

            if (exercisesSnap?.exists()) {
              const data = exercisesSnap.data();
              if (data.exercises && Array.isArray(data.exercises)) {
                let exDist = 0;
                let exCals = 0;
                data.exercises.forEach((ex: any) => {
                  if (ex.heart_rate?.average) {
                    dayHrSum += ex.heart_rate.average;
                    dayHrCount++;
                  }
                  if (typeof ex.distance === 'number') exDist += ex.distance;
                  if (typeof ex.calories === 'number') exCals += ex.calories;
                });

                // Fallback only if activities didn't provide these
                if (dayDist === 0) dayDist = Math.round(exDist);
                if (dayCals === 0) dayCals = Math.round(exCals);
              }
            }

            hrHistory.push(dayHrCount > 0 ? Math.round(dayHrSum / dayHrCount) : 0);
            distanceHistory.push(dayDist);
            caloriesHistory.push(dayCals);

            // Sleep score (0 if missing)
            const sleepDoc = sleepDocs[index];
            if (sleepDoc?.exists()) {
              const sleepScore = sleepDoc.data()?.sleep_score;
              sleepHistory.push(typeof sleepScore === 'number' ? sleepScore : 0);
            } else {
              sleepHistory.push(0);
            }
          });

          // Fallback: try to derive lastSync from latest sync summary if user profile doesn't have it
          if (!lastSync) {
            try {
              const summaryQuery = query(
                collection(db, `users/${userId}/polarData/syncSummary/all`),
                orderBy('syncedAt', 'desc'),
                limit(1)
              );
              const summarySnapshot = await getDocs(summaryQuery);
              if (!summarySnapshot.empty) {
                lastSync = summarySnapshot.docs[0].data()?.syncedAt;
              }
            } catch (e) {
              // ignore
            }
          }

          // Data is already chronological (Oldest -> Newest)
          
          // Generate labels (MM/DD)
          const labels = datesToCheck.map(dateStr => {
            const [y, m, d] = dateStr.split('-');
            return `${parseInt(m)}/${parseInt(d)}`;
          });
          
          // Calculate Averages (ignoring 0s for HR, but maybe keeping them for others? 
          // Usually average daily steps/cals includes rest days as 0 or low, but let's exclude 0 for "active" stats if preferred.
          // For now, let's exclude 0s for HR, include 0s for others or exclude? 
          // Let's exclude 0s to show "Active Day Average")
          
          const validHrs = hrHistory.filter(v => v > 0);
          const avgHr = validHrs.length > 0 ? Math.round(validHrs.reduce((a, b) => a + b, 0) / validHrs.length) : 0;

          const validDist = distanceHistory.filter(v => v > 0);
          const avgDistance = validDist.length > 0 ? Math.round(validDist.reduce((a, b) => a + b, 0) / validDist.length) : 0;

          const validCals = caloriesHistory.filter(v => v > 0);
          const avgCalories = validCals.length > 0 ? Math.round(validCals.reduce((a, b) => a + b, 0) / validCals.length) : 0;

          const validSleep = sleepHistory.filter(v => v > 0);
          const avgSleep = validSleep.length > 0 ? Math.round(validSleep.reduce((a, b) => a + b, 0) / validSleep.length) : 0;

          // Determine trend based on Calories (or HR?) - Let's use Calories as "Effort"
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (validCals.length >= 2) {
            const recent = validCals[validCals.length - 1];
            const previous = validCals[validCals.length - 2];
            if (recent > previous + 50) trend = 'up';
            else if (recent < previous - 50) trend = 'down';
          }

          return {
            id: userId,
            displayName: userData.displayName || 'Unknown Cadet',
            photoURL: userData.photoURL,
            lastSync,
            hrHistory,
            distanceHistory,
            sleepHistory,
            caloriesHistory,
            labels,
            avgHr,
            avgDistance,
            avgSleep,
            avgCalories,
            trend
          } as StudentStats;
        } catch (err) {
          console.warn(`Failed to fetch data for user ${userDoc.id}`, err);
          return null;
        }
      }));

      setStudents(studentsData.filter((s): s is StudentStats => s !== null));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (isInstructor) {
      fetchStudentsData(dateRange);
    }
  }, [isInstructor, fetchStudentsData, dateRange]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudentsData(dateRange);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    // If in selection mode and we have selections, maybe we want to filter?
    // For now, let's just show all and let the user select.
    // Or if the user wants to "view selected", we can add a toggle for that.
    return matchesSearch;
  });

  // Main view shows ONLY selected students (or all if none selected? No, user wants to choose)
  // If no selection, show empty state prompting to select.
  const displayedStudents = students.filter(s => selectedUserIds.includes(s.id));

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    const currentDate = selectedDate || (datePickerMode === 'start' ? dateRange.start : dateRange.end);
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (datePickerMode === 'start') {
        setDateRange(prev => ({ ...prev, start: currentDate, type: 'custom' }));
        // Small delay to allow the first picker to close completely
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 100);
      } else {
        setDateRange(prev => ({ ...prev, end: currentDate, type: 'custom' }));
      }
    } else {
      // For iOS, we might want to handle this differently, but for now:
      setShowDatePicker(false); // Close on selection for simplicity
      if (datePickerMode === 'start') {
        setDateRange(prev => ({ ...prev, start: currentDate, type: 'custom' }));
        setTimeout(() => {
          setDatePickerMode('end');
          setShowDatePicker(true);
        }, 500);
      } else {
        setDateRange(prev => ({ ...prev, end: currentDate, type: 'custom' }));
      }
    }
  };

  if (instructorLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!isInstructor) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Access Denied</Text>
        <Text>You must be an instructor to view this page.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Instructor Dashboard</Text>
          </View>
        </View>
        
        <Text style={styles.subtitle}>{students.length} Cadets Enrolled</Text>
        
        {/* Date Range Selector */}
        {!isWideWeb ? (
          <View style={styles.filterContainer}>
            <View style={styles.rangeRow}>
              <Text style={styles.filterLabel}>Range:</Text>
              <View style={styles.rangeButtons}>
                {[7, 14, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.rangeButton, dateRange.type === `${days}d` && styles.rangeButtonActive]}
                    onPress={() =>
                      setDateRange({
                        start: new Date(new Date().setDate(new Date().getDate() - (days - 1))),
                        end: new Date(),
                        type: `${days}d` as any,
                      })
                    }
                  >
                    <Text style={[styles.rangeButtonText, dateRange.type === `${days}d` && styles.rangeButtonTextActive]}>
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.rangeButton, dateRange.type === 'custom' && styles.rangeButtonActive]}
                  onPress={() => {
                    setDatePickerMode('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar" size={16} color={dateRange.type === 'custom' ? '#FFF' : '#666'} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsVisible(true)}>
                <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.selectButtonText}>Manage Cadets</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.filterContainerWideWeb}>
            <View style={styles.rangeRowWideWeb}>
              <Text style={styles.filterLabel}>Range:</Text>
              <View style={styles.rangeButtonsWideWeb}>
                {[7, 14, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.rangeButton, dateRange.type === `${days}d` && styles.rangeButtonActive]}
                    onPress={() =>
                      setDateRange({
                        start: new Date(new Date().setDate(new Date().getDate() - (days - 1))),
                        end: new Date(),
                        type: `${days}d` as any,
                      })
                    }
                  >
                    <Text style={[styles.rangeButtonText, dateRange.type === `${days}d` && styles.rangeButtonTextActive]}>
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.rangeButton, dateRange.type === 'custom' && styles.rangeButtonActive]}
                  onPress={() => {
                    setDatePickerMode('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar" size={16} color={dateRange.type === 'custom' ? '#FFF' : '#666'} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionsRowWideWeb}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsVisible(true)}>
                <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.selectButtonText}>Manage Cadets</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Only show search if we have items to search */}
        {displayedStudents.length > 0 && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tracked cadets..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
        )}
      </View>

      <FlatList
        data={displayedStudents.filter(s => s.displayName.toLowerCase().includes(searchQuery.toLowerCase()))}
        renderItem={({ item }) => (
          <StudentCard 
            item={item} 
            isSelectionMode={false}
            chartConfig={chartConfig}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No cadets being tracked.</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Select Cadets to View</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cadets</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={students}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem} 
                  onPress={() => toggleUser(item.id)}
                >
                  <View style={[styles.checkbox, selectedUserIds.includes(item.id) && styles.checkboxSelected]}>
                    {selectedUserIds.includes(item.id) && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.modalItemText}>{item.displayName}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chart Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsContent}>
              <Text style={styles.sectionTitle}>Customize Graphs</Text>

              {(['distance', 'hr', 'sleep', 'calories'] as const).map((metric) => {
                const type = chartConfig[metric];
                return (
                <View key={metric} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>
                    {metric === 'hr' ? 'Heart Rate' : 
                     metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </Text>
                  <View style={styles.typeSelector}>
                    {(['line', 'bar', 'area', 'scatter'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeOption,
                          type === t && styles.typeOptionSelected
                        ]}
                        onPress={() => setChartConfig(prev => ({ ...prev, [metric]: t }))}
                      >
                        <Text style={[
                          styles.typeOptionText,
                          type === t && styles.typeOptionTextSelected
                        ]}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                );
              })}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Web Date Picker Modal */}
      {Platform.OS === 'web' && showDatePicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.webModalOverlay}>
            <View style={styles.webModalContent}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              
              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>Start:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: (dateRange.start instanceof Date ? dateRange.start : new Date()).toISOString().split('T')[0],
                  onChange: (e: any) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setDateRange(prev => ({ ...prev, start: date, type: 'custom' }));
                    }
                  },
                  style: {
                    padding: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    fontSize: 16,
                  }
                })}
              </View>

              <View style={styles.webDateRow}>
                <Text style={styles.webDateLabel}>End:</Text>
                {React.createElement('input', {
                  type: 'date',
                  value: (dateRange.end instanceof Date ? dateRange.end : new Date()).toISOString().split('T')[0],
                  onChange: (e: any) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setDateRange(prev => ({ ...prev, end: date, type: 'custom' }));
                    }
                  },
                  style: {
                    padding: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    fontSize: 16,
                  }
                })}
              </View>

              <TouchableOpacity 
                style={styles.webApplyButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.webApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Native Date Picker */}
      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? (dateRange.start instanceof Date ? dateRange.start : new Date()) : (dateRange.end instanceof Date ? dateRange.end : new Date())}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    textAlign: 'center',
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  selectButtonActive: {
    backgroundColor: '#FF6B35',
  },
  selectButtonText: {
    color: '#636E72',
    fontWeight: '600',
  },
  selectButtonTextActive: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    marginTop: 4,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  filterContainerWideWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 16,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeRowWideWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionsRowWideWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexShrink: 0,
  },
  filterLabel: {
    fontSize: 14,
    color: '#636E72',
    marginRight: 12,
  },
  rangeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeButtonsWideWeb: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
  },
  rangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  rangeButtonActive: {
    backgroundColor: '#2D3436',
  },
  rangeButtonText: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF5F0',
    borderRadius: 8,
  },
  selectionText: {
    color: '#FF6B35',
    fontWeight: 'bold',
    marginRight: 8,
  },
  selectionHint: {
    color: '#FF6B35',
    fontSize: 12,
  },
  clearButtonText: {
    color: '#FF6B35',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#636E72',
    fontSize: 16,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2D3436',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF5F0',
  },
  settingsContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  settingRow: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeOptionSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeOptionText: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
  },
  typeOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  webDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  webDateLabel: {
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '500',
  },
  webApplyButton: {
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  webApplyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
