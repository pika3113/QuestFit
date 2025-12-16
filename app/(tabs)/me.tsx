import React, { useState, useEffect, useCallback } from 'react';
// Modernized Me Screen
import { 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  StyleSheet, 
  Dimensions,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { SkeletonBlock } from '@/components/Skeleton';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/src/hooks/useAuth';
import { db } from '@/src/services/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Creature } from '@/src/types/polar';
import creatureService from '@/src/services/creatureService';
import { polarOAuthService } from '@/src/services/polarOAuthService';
import { ConsentModal } from '@/components/auth/ConsentModal';
import { PolarLinkScreen } from '@/components/auth/PolarLinkScreen';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal } from 'react-native';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

const { width } = Dimensions.get('window');

const ModernColors = {
  primary: '#FF6B35',
  secondary: '#2E86AB',
  accent: '#A23B72',
  background: '#F8F9FA',
  card: '#FFFFFF',
  text: '#2D3436',
  textSecondary: '#636E72',
  success: '#00B894',
  warning: '#FDCB6E',
  surface: '#FFFFFF',
  danger: '#EF4444',
};

interface WorkoutHistoryItem {
  id: string;
  date: Date;
  duration: string;
  calories: number;
  distance: number;
  heartRate: number;
  activityType: string;
}

export default function MeScreen() {
  const colorScheme = useColorScheme();
  const { user, signOut } = useAuth();
  const [currentXP, setCurrentXP] = useState<number>(0);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryItem[]>([]);
  const [capturedCreatures, setCapturedCreatures] = useState<Creature[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
  const [totalCalories, setTotalCalories] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [totalAvgHeartRate, setTotalAvgHeartRate] = useState<number>(0);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const [restingHr, setRestingHr] = useState<number | null>(null);
  const [vo2Max, setVo2Max] = useState<number | null>(null);
  const [lastPhysicalSync, setLastPhysicalSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPolarModal, setShowPolarModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserXP();
    }
  }, [user]);

  const loadUserXP = async () => {
    try {
      setError(null);
      if (!user) return;

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setCurrentXP(data.xp || 0);
        setTotalWorkouts(data.totalWorkouts || 0);
        setTotalCalories(data.totalCalories || 0);
        setTotalDuration(data.totalDuration || 0);
        setTotalAvgHeartRate(data.totalAvgHeartRate || 0);
        setWeight(data.weight || null);
        setHeight(data.height || null);
        setAge(data.age || null);
        setGender(data.gender || null);
        setMaxHr(data['maximum-hr'] || null);
        setRestingHr(data['resting-hr'] || null);
        setVo2Max(data['vo2-max'] || null);
        setLastPhysicalSync(data.lastPhysicalSync || null);
        
        const creatureIds = data.capturedCreatures || [];
        const creatures = creatureIds
          .map((id: string) => creatureService.getCreatureById(id))
          .filter((c: Creature | null) => c !== null) as Creature[];
        setCapturedCreatures(creatures);
        
        const history = data.workoutHistory || [];
        const sortedHistory = history
          .map((item: any) => ({
            ...item,
            date: item.date?.toDate ? item.date.toDate() : new Date(item.date)
          }))
          .sort((a: WorkoutHistoryItem, b: WorkoutHistoryItem) => 
            b.date.getTime() - a.date.getTime()
          )
          .slice(0, 5); // Only show last 5
        setWorkoutHistory(sortedHistory);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserXP();
  }, []);

  const performAccountDeletion = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await polarOAuthService.disconnectPolarAccount(user.uid);
      await deleteDoc(doc(db, 'users', user.uid));
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account.');
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure? This cannot be undone.')) performAccountDeletion();
    } else {
      Alert.alert('Delete Account', 'Are you sure? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performAccountDeletion }
      ]);
    }
  };

  const handleConsentAccept = async () => {
    if (!user) return;
    try {
      setConsentLoading(true);
      await polarOAuthService.setConsentGiven(user.uid);
      setShowConsentModal(false);
      Alert.alert('Success', 'Consent recorded.');
    } catch (error) {
      Alert.alert('Error', 'Failed to record consent.');
    } finally {
      setConsentLoading(false);
    }
  };

  const handlePolarLinkSuccess = () => {
    setShowPolarModal(false);
    // Optionally refresh user data or show success message
    loadUserXP();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={false}>
          <MeSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModernColors.primary} />
        }
      >
        {/* Profile Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(user?.displayName || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.displayName || 'Adventurer'}</Text>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{currentXP} QP</Text>
          </View>
        </View>

        {/* Stats Overview */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            icon="barbell" 
            value={totalWorkouts.toString()} 
            label="Workouts" 
            color={ModernColors.primary} 
          />
          <StatCard 
            icon="flame" 
            value={totalCalories.toLocaleString()} 
            label="Calories" 
            color={ModernColors.secondary} 
          />
          <StatCard 
            icon="time" 
            value={`${Math.round(totalDuration / 60)}h`} 
            label="Duration" 
            color={ModernColors.accent} 
          />
          <StatCard 
            icon="heart" 
            value={totalAvgHeartRate > 0 ? `${Math.round(totalAvgHeartRate)}` : '-'} 
            label="Avg HR" 
            color={ModernColors.success} 
          />
        </View>

        {/* Physical Attributes */}
        <Text style={styles.sectionTitle}>Physical Profile</Text>
        <View style={styles.card}>
          <View style={styles.attributesGrid}>
            <AttributeItem label="Weight" value={weight ? `${weight} kg` : '-'} icon="scale" />
            <AttributeItem label="Height" value={height ? `${height} cm` : '-'} icon="resize" />
            <AttributeItem label="Age" value={age ? `${age}` : '-'} icon="calendar" />
            <AttributeItem label="VO2 Max" value={vo2Max ? `${vo2Max}` : '-'} icon="speedometer" />
          </View>
          {lastPhysicalSync && (
            <Text style={styles.lastSync}>
              Last synced: {formatDateDdMmYyyy(lastPhysicalSync)}
            </Text>
          )}
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.card}>
          {workoutHistory.length > 0 ? (
            workoutHistory.map((workout, index) => (
              <View key={index} style={[
                styles.historyItem,
                index === workoutHistory.length - 1 && { borderBottomWidth: 0 }
              ]}>
                <View style={styles.historyIcon}>
                  <Ionicons name="fitness" size={20} color={ModernColors.primary} />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyType}>{workout.activityType || 'Workout'}</Text>
                  <Text style={styles.historyDate}>{formatDateDdMmYyyy(workout.date)}</Text>
                </View>
                <View style={styles.historyStats}>
                  <Text style={styles.historyValue}>{workout.calories} cal</Text>
                  <Text style={styles.historySubValue}>{workout.duration}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent workouts found</Text>
          )}
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="calendar"
            label="View Daily Activity, Exercise & Sleep"
            onPress={() => router.push('/history')}
            color={ModernColors.primary}
          />
          <SettingsRow
            icon="barbell"
            label="My Exercises (Detailed)"
            onPress={() => router.push('/me-exercises')}
            color={ModernColors.secondary}
          />
        </View>

        {/* Settings & Actions */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <SettingsRow 
            icon="document-text" 
            label="Show User Consent Agreement" 
            onPress={() => setShowConsentModal(true)} 
            color={ModernColors.secondary}
          />
          <SettingsRow 
            icon="log-out" 
            label="Sign Out" 
            onPress={signOut} 
            color={ModernColors.warning}
          />
          <SettingsRow 
            icon="trash" 
            label="Delete Account" 
            onPress={handleDeleteAccount} 
            color={ModernColors.danger}
            danger
          />
        </View>

        <View style={{ height: 40, backgroundColor: 'transparent' }} />
      </ScrollView>

      <Modal
        visible={showPolarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPolarModal(false)}
      >
        <PolarLinkScreen 
          userId={user?.uid || ''}
          onLinkSuccess={handlePolarLinkSuccess}
          onSkip={() => setShowPolarModal(false)}
        />
      </Modal>

      <ConsentModal
        visible={showConsentModal}
        onConsent={() => setShowConsentModal(false)}
        readOnly={true}
      />
    </SafeAreaView>
  );
}

function MeSkeleton() {
  return (
    <View style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={[styles.avatarContainer, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
          <SkeletonBlock width={46} height={46} radius={23} />
        </View>
        <SkeletonBlock width={200} height={18} radius={10} style={{ marginTop: 14 }} />
        <View style={[styles.xpBadge, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
          <SkeletonBlock width={70} height={14} radius={8} />
        </View>
      </View>

      {/* Overview */}
      <SkeletonBlock width={120} height={16} radius={8} style={{ marginTop: 18, marginBottom: 12 }} />
      <View style={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={`me-stat-skel-${idx}`} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={18} height={18} radius={9} />
            </View>
            <SkeletonBlock width={70} height={18} radius={8} style={{ marginTop: 10 }} />
            <SkeletonBlock width={80} height={10} radius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Physical Profile */}
      <SkeletonBlock width={160} height={16} radius={8} style={{ marginTop: 18, marginBottom: 12 }} />
      <View style={styles.card}>
        <View style={styles.attributesGrid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={`me-attr-skel-${idx}`} style={styles.attributeItem}>
              <View style={[styles.attributeIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                <SkeletonBlock width={18} height={18} radius={9} />
              </View>
              <SkeletonBlock width={80} height={10} radius={6} style={{ marginTop: 10 }} />
              <SkeletonBlock width={60} height={14} radius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <SkeletonBlock width={180} height={12} radius={6} style={{ marginTop: 14 }} />
      </View>

      {/* Recent Activity */}
      <SkeletonBlock width={150} height={16} radius={8} style={{ marginTop: 18, marginBottom: 12 }} />
      <View style={styles.card}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <View
            key={`me-history-skel-${idx}`}
            style={[styles.historyItem, idx === 2 && { borderBottomWidth: 0 }]}
          >
            <View style={[styles.historyIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={18} height={18} radius={9} />
            </View>
            <View style={styles.historyInfo}>
              <SkeletonBlock width={140} height={12} radius={6} />
              <SkeletonBlock width={110} height={10} radius={6} style={{ marginTop: 8 }} />
            </View>
            <View style={styles.historyStats}>
              <SkeletonBlock width={56} height={12} radius={6} />
              <SkeletonBlock width={46} height={10} radius={6} style={{ marginTop: 8 }} />
            </View>
          </View>
        ))}
      </View>

      {/* History */}
      <SkeletonBlock width={90} height={16} radius={8} style={{ marginTop: 18, marginBottom: 12 }} />
      <View style={styles.card}>
        {Array.from({ length: 2 }).map((_, idx) => (
          <View key={`me-row-skel-h-${idx}`} style={styles.settingsRow}>
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={18} height={18} radius={9} />
            </View>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <SkeletonBlock width={'85%'} height={12} radius={6} />
            </View>
          </View>
        ))}
      </View>

      {/* Settings */}
      <SkeletonBlock width={100} height={16} radius={8} style={{ marginTop: 18, marginBottom: 12 }} />
      <View style={styles.card}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <View key={`me-row-skel-s-${idx}`} style={styles.settingsRow}>
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={18} height={18} radius={9} />
            </View>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <SkeletonBlock width={'75%'} height={12} radius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Helper Components
const StatCard = ({ icon, value, label, color }: { icon: any, value: string, label: string, color: string }) => (
  <View style={styles.statCard}>
    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const AttributeItem = ({ label, value, icon }: { label: string, value: string, icon: any }) => (
  <View style={styles.attributeItem}>
    <Ionicons name={icon} size={16} color={ModernColors.textSecondary} style={{ marginBottom: 4 }} />
    <Text style={styles.attributeValue}>{value}</Text>
    <Text style={styles.attributeLabel}>{label}</Text>
  </View>
);

const SettingsRow = ({ icon, label, onPress, color, danger }: { icon: any, label: string, onPress: () => void, color: string, danger?: boolean }) => (
  <TouchableOpacity style={styles.settingsRow} onPress={onPress}>
    <View style={[styles.settingsIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.settingsLabel, danger && { color: ModernColors.danger }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={20} color="#E0E0E0" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 20,
  },
  contentMaxWidth: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'transparent',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: ModernColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    marginBottom: 12,
  },
  xpBadge: {
    backgroundColor: ModernColors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpText: {
    color: ModernColors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 12,
    textAlign: 'center',
    marginLeft: 0,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: 'transparent',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: ModernColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  card: {
    backgroundColor: ModernColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  attributesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  attributeItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  attributeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 2,
  },
  attributeLabel: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  lastSync: {
    fontSize: 10,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: 'transparent',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ModernColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  historyType: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  historyDate: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  historyStats: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  historyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
  },
  historySubValue: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: ModernColors.textSecondary,
    padding: 20,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    color: ModernColors.text,
    fontWeight: '500',
  },
});
