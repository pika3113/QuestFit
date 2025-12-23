import React, { useState, useCallback } from 'react';
import { 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl, 
  Platform,
  Dimensions,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { SkeletonBlock } from '@/components/Skeleton';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { useInstructor } from '@/src/hooks/useInstructor';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getNextReward, getRewardProgress, REWARDS, Reward, MAX_XP } from '@/src/utils/rewardsSystem';
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
};

export default function HomeScreen() {
  const { user } = useAuth();
  const userId = user?.uid || "demo-user";
  const { profile, loading, addExperience, updateProfile } = useGameProfile(userId);
  const { isInstructor } = useInstructor(userId);
  const [refreshing, setRefreshing] = useState(false);
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // In a real app, we would trigger a re-fetch here.
    // Since useGameProfile doesn't expose a refresh method yet, 
    // we'll just simulate a delay.
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return formatDateDdMmYyyy(new Date());
  };

  const performRedemption = async (reward: Reward) => {
    try {
      // 1. Deduct XP
      await addExperience(-reward.xpThreshold);
      
      // 2. Add to redeemed rewards
      const newReward = {
        id: Date.now().toString(),
        rewardId: reward.id,
        name: reward.name,
        redeemedAt: new Date().toISOString(),
        code: Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      
      const currentRedeemed = profile?.redeemedRewards || [];
      await updateProfile({
        redeemedRewards: [...currentRedeemed, newReward]
      });

      if (Platform.OS === 'web') {
        window.alert(`Success: You redeemed ${reward.name}!`);
      } else {
        Alert.alert("Success", `You redeemed ${reward.name}!`);
      }
      setRedeemModalVisible(false);
    } catch (error) {
      console.error("Redemption failed:", error);
      if (Platform.OS === 'web') {
        window.alert("Failed to redeem reward. Please try again.");
      } else {
        Alert.alert("Error", "Failed to redeem reward. Please try again.");
      }
    }
  };

  const formatRewardLabelForBar = (rewardName: string) => {
    const base = typeof rewardName === 'string' ? rewardName.replace(/\s+tier\s*$/i, '').trim() : '';
    if (!base) return '';

    const match = base.match(/^\$(\d+(?:\.\d+)?)\b[\s\S]*\bvoucher\b/i);
    if (match) return `$${match[1]} Voucher`;

    return base;
  };

  const handleRedeem = async (reward: Reward) => {
    if ((profile?.xp || 0) < reward.xpThreshold) {
      if (Platform.OS === 'web') {
        window.alert("You don't have enough XP for this reward.");
      } else {
        Alert.alert("Insufficient XP", "You don't have enough XP for this reward.");
      }
      return;
    }
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to redeem ${reward.name} for ${reward.xpThreshold} QP?`);
      if (confirmed) {
        await performRedemption(reward);
      }
    } else {
      Alert.alert(
        "Redeem Reward",
        `Are you sure you want to redeem ${reward.name} for ${reward.xpThreshold} QP?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Redeem", 
            onPress: () => performRedemption(reward)
          }
        ]
      );
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: ModernColors.background }} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          scrollEnabled={false}
        >
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const nextReward = profile ? getNextReward(profile.xp) : null;
  const progress = profile ? getRewardProgress(profile.xp) : 0;
  const creatureCount = profile?.capturedCreatures?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: ModernColors.background }} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModernColors.primary} />
      }
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.dateText}>{formatDate()}</Text>
          <Text style={styles.greetingText}>{getGreeting()},</Text>
          <Text style={styles.nameText}>{user?.displayName || 'Adventurer'}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/me')}>
          {/* Placeholder for avatar */}
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(user?.displayName || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Adventure Progress Card */}
      <View style={styles.levelCard}>
        <View style={styles.levelInfo}>
          <View style={{ backgroundColor: 'transparent' }}>
            <Text style={styles.levelLabel}>Total QuestPoints</Text>
            <Text style={styles.levelValue}>{profile?.xp || 0}</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{creatureCount} Creatures unlocked</Text>
          </View>
        </View>
        
        {/* Reward Labels */}
        <View style={styles.rewardLabelsContainer}>
          {REWARDS.map((reward) => {
            const percentage = (reward.xpThreshold / MAX_XP) * 100;
            const name = formatRewardLabelForBar(reward.name);
            return (
              <Text 
                key={reward.id} 
                style={[styles.rewardLabel, { left: `${percentage}%` }]}
              >
                {name}
              </Text>
            );
          })}
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          {/* Reward Indicators */}
          {REWARDS.map((reward) => {
            const percentage = reward.xpThreshold / MAX_XP;
            const isUnlocked = (profile?.xp || 0) >= reward.xpThreshold;
            const isLast = percentage === 1;
            
            return (
              <View 
                key={reward.id} 
                style={[
                  styles.rewardMarker, 
                  isLast ? { right: 0 } : { left: `${percentage * 100}%`, marginLeft: -3 },
                  { backgroundColor: isUnlocked ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }
                ]} 
              />
            );
          })}
        </View>
        
        {/* <Text style={styles.nextLevelText}>
          {nextReward ? `Next Reward: ${nextReward.name}` : 'All Rewards Unlocked!'}
        </Text> */}

        <TouchableOpacity 
          style={styles.redeemButton}
          onPress={() => setRedeemModalVisible(true)}
        >
          <Text style={styles.redeemButtonText}>Redeem Rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsContainer}>
        <QuickActionButton 
          icon="fitness" 
          label="Workout" 
          color="#FF6B35" 
          onPress={() => router.push('/workout')} 
        />
        <QuickActionButton 
          icon="flash" 
          label="Battle" 
          color="#6C5CE7" 
          onPress={() => router.push('/battle')} 
        />
        <QuickActionButton 
          icon="paw" 
          label="Creatures" 
          color="#2E86AB" 
          onPress={() => router.push('/creatures')} 
        />
        <QuickActionButton 
          icon="medal"
          label="Achievements"
          color="#00B894"
          onPress={() => router.push('/achievements')}
        />
        <QuickActionButton 
          icon="trophy" 
          label="Profile" 
          color="#FDCB6E" 
          onPress={() => router.push('/me')} 
        />
        <QuickActionButton 
          icon="gift" 
          label="Rewards" 
          color="#A23B72" 
          onPress={() => router.push('/rewards/my-rewards')} 
        />
        {(isInstructor || userId === 'demo-user') && (
          <QuickActionButton 
            icon="school" 
            label="Instructor" 
            color="#6C5CE7" 
            onPress={() => router.push('/instr-dashboard')} 
          />
        )}
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Your Journey</Text>
      <View style={styles.statsGrid}>
        <StatCard 
          icon="flame" 
          value={(profile?.totalCalories || 0).toLocaleString()} 
          label="Calories" 
          color="#FF6B35" 
        />
        <StatCard 
          icon="walk" 
          value={(profile?.totalDistance || 0).toFixed(1)} 
          label="km Distance" 
          color="#2E86AB" 
        />
        <StatCard 
          icon="barbell" 
          value={(profile?.totalWorkouts || 0).toString()} 
          label="Workouts" 
          color="#A23B72" 
        />
        <StatCard 
          icon="time" 
          value={Math.round((profile?.totalDuration || 0) / 60).toString()} 
          label="Hours Active" 
          color="#00B894" 
        />
      </View>

      {/* Recent Activity / Motivation */}
      <View style={styles.motivationCard}>
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="bulb" size={24} color="#FDCB6E" style={{ marginRight: 8 }} />
          <Text style={styles.motivationTitle}>Did you know?</Text>
        </View>
        <Text style={styles.motivationText}>
          Consistent training unlocks rarer creatures. Keep your streak alive to find Legendary beasts!
        </Text>
      </View>

      <View style={{ height: 40, backgroundColor: 'transparent' }} />

      <Modal
        animationType="slide"
        transparent={true}
        visible={redeemModalVisible}
        onRequestClose={() => setRedeemModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem Rewards</Text>
              <TouchableOpacity onPress={() => setRedeemModalVisible(false)}>
                <Ionicons name="close" size={24} color={ModernColors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Current QPs: {profile?.xp || 0}</Text>
            
            <ScrollView style={styles.rewardsList}>
              {REWARDS.map((reward) => {
                const canRedeem = (profile?.xp || 0) >= reward.xpThreshold;
                return (
                  <View key={reward.id} style={styles.rewardItem}>
                    <View style={{flex: 1, backgroundColor: 'transparent'}}>
                      <Text style={styles.rewardName}>{reward.name}</Text>
                      <Text style={styles.rewardCost}>{reward.xpThreshold} QP</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.redeemActionBtn, !canRedeem && styles.redeemActionBtnDisabled]}
                      disabled={!canRedeem}
                      onPress={() => handleRedeem(reward)}
                    >
                      <Text style={styles.redeemActionBtnText}>
                        {canRedeem ? 'Redeem' : 'Locked'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent', flex: 1, paddingRight: 12 }}>
          <SkeletonBlock width={120} height={12} radius={6} />
          <SkeletonBlock width={180} height={22} radius={10} style={{ marginTop: 10 }} />
          <SkeletonBlock width={220} height={26} radius={12} style={{ marginTop: 10 }} />
        </View>
        <View style={styles.avatarPlaceholder}>
          <SkeletonBlock width={46} height={46} radius={23} />
        </View>
      </View>

      {/* Progress / Level Card */}
      <View style={styles.levelCard}>
        <View style={[styles.levelInfo, { backgroundColor: 'transparent' }]}>
          <View style={{ backgroundColor: 'transparent' }}>
            <SkeletonBlock width={160} height={12} radius={6} />
            <SkeletonBlock width={110} height={34} radius={12} style={{ marginTop: 12 }} />
          </View>
          <View style={[styles.xpBadge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <SkeletonBlock width={140} height={14} radius={8} />
          </View>
        </View>

        <View style={[styles.progressBarContainer, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={{ height: '100%', width: '45%', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 6 }} />
        </View>

        <View style={[styles.redeemButton, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
          <SkeletonBlock width={140} height={14} radius={8} />
        </View>
      </View>

      {/* Quick Actions */}
      <SkeletonBlock width={140} height={16} radius={8} style={{ marginBottom: 12 }} />
      <View style={styles.quickActionsContainer}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <View key={`qa-skel-${idx}`} style={styles.actionButton}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={24} height={24} radius={12} />
            </View>
            <SkeletonBlock width={54} height={12} radius={6} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>

      {/* Stats */}
      <SkeletonBlock width={140} height={16} radius={8} style={{ marginTop: 8, marginBottom: 12 }} />
      <View style={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={`stat-skel-${idx}`} style={styles.statCard}>
            <View style={[styles.miniIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <SkeletonBlock width={18} height={18} radius={9} />
            </View>
            <SkeletonBlock width={70} height={18} radius={8} style={{ marginTop: 10 }} />
            <SkeletonBlock width={90} height={10} radius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Motivation */}
      <View style={styles.motivationCard}>
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <SkeletonBlock width={24} height={24} radius={12} style={{ marginRight: 8 }} />
          <SkeletonBlock width={120} height={14} radius={8} />
        </View>
        <SkeletonBlock width={'100%'} height={12} radius={8} />
        <SkeletonBlock width={'90%'} height={12} radius={8} style={{ marginTop: 8 }} />
        <SkeletonBlock width={'70%'} height={12} radius={8} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

// Helper Components
const QuickActionButton = ({ icon, label, color, onPress }: { icon: any, label: string, color: string, onPress: () => void }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatCard = ({ icon, value, label, color }: { icon: any, value: string, label: string, color: string }) => (
  <View style={styles.statCard}>
    <View style={[styles.miniIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 42 : 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  dateText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greetingText: {
    fontSize: 24,
    color: ModernColors.text,
    fontWeight: '300',
  },
  nameText: {
    fontSize: 28,
    color: ModernColors.text,
    fontWeight: 'bold',
  },
  profileButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  levelCard: {
    backgroundColor: ModernColors.text, // Dark background
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    shadowColor: ModernColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  levelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  levelLabel: {
    color: '#A0A0A0',
    fontSize: 14,
    marginBottom: 4,
  },
  levelValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  xpBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xpText: {
    color: ModernColors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: ModernColors.primary,
    borderRadius: 6,
  },
  rewardMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    zIndex: 1,
  },
  rewardLabelsContainer: {
    height: 20,
    width: '100%',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  rewardLabel: {
    position: 'absolute',
    bottom: 0,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    width: 50,
    marginLeft: -25, // Center on the point
    textAlign: 'center',
  },
  nextLevelText: {
    color: '#A0A0A0',
    fontSize: 12,
    textAlign: 'right',
  },
  redeemButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  redeemButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 30,
    backgroundColor: 'transparent',
  },
  actionButton: {
    alignItems: 'center',
    width: (width - 40) / 4,
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  statCard: {
    width: (width - 56) / 2,
    backgroundColor: ModernColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  motivationCard: {
    backgroundColor: ModernColors.card,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: ModernColors.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  motivationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 4,
  },
  motivationText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: ModernColors.card,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ModernColors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    marginBottom: 20,
  },
  rewardsList: {
    maxHeight: 400,
  },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'transparent',
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  rewardCost: {
    fontSize: 14,
    color: ModernColors.primary,
    marginTop: 2,
  },
  redeemActionBtn: {
    backgroundColor: ModernColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  redeemActionBtnDisabled: {
    backgroundColor: '#E0E0E0',
  },
  redeemActionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
