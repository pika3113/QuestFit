import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';
import { REWARDS } from '@/src/utils/rewardsSystem';

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

export default function MyRewardsScreen() {
  const { user } = useAuth();
  const userId = user?.uid || "demo-user";
  const { profile, loading } = useGameProfile(userId);

  const redeemedRewards = profile?.redeemedRewards || [];

  const formatRewardName = (reward: any) => {
    const rawName = typeof reward?.name === 'string' ? reward.name.trim() : '';
    const rewardId = typeof reward?.rewardId === 'string' ? reward.rewardId : '';

    // Prefer the name that was stored at redemption time.
    if (rawName && rawName.toLowerCase() !== 'voucher') return rawName;

    // Backward compatibility: if older data only stored "voucher", use the current catalog name.
    if (rewardId) {
      const catalog = REWARDS.find((r) => r.id === rewardId);
      if (catalog?.name) return catalog.name;
    }

    return rawName || 'Voucher';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'My Rewards', headerBackTitle: 'Back' }} />
      
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {redeemedRewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={64} color={ModernColors.textSecondary} />
            <Text style={styles.emptyStateText}>No rewards redeemed yet.</Text>
            <Text style={styles.emptyStateSubtext}>Earn XP and redeem rewards from the Home screen!</Text>
          </View>
        ) : (
          redeemedRewards.map((reward) => (
            <View key={reward.id} style={styles.ticketCard}>
              <View style={styles.ticketLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="ticket" size={32} color={ModernColors.primary} />
                </View>
              </View>
              
              <View style={styles.ticketRight}>
                <Text style={styles.rewardName}>{formatRewardName(reward)}</Text>
                <Text style={styles.redeemedDate}>
                  Redeemed on {formatDateDdMmYyyy(reward.redeemedAt)}
                </Text>
                {reward.code && (
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeLabel}>CODE:</Text>
                    <Text style={styles.codeValue}>{reward.code}</Text>
                  </View>
                )}
              </View>
              
              {/* Decorative circles for ticket look */}
              <View style={[styles.ticketCircle, { top: -10, left: 70 }]} />
              <View style={[styles.ticketCircle, { bottom: -10, left: 70 }]} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  contentContainer: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    backgroundColor: 'transparent',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: ModernColors.card,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  ticketLeft: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
    borderRightColor: '#F0F0F0',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  ticketRight: {
    flex: 1,
    padding: 16,
    paddingLeft: 24,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 4,
  },
  redeemedDate: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: ModernColors.textSecondary,
    marginRight: 4,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ModernColors.primary,
    letterSpacing: 1,
  },
  ticketCircle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ModernColors.background,
  },
});
