import React from 'react';
import { Platform, View, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Themed';
import { router } from 'expo-router';
import { instructorDashboardStyles as styles } from '@/src/styles/screens/instructorDashboardStyles';
import { User, UserOverview } from '../types';
import { formatCompactNumber } from '@/src/utils/numberFormat';

interface UserCardProps {
  user: User;
  overview?: UserOverview;
}

export const UserCard = ({ user, overview }: UserCardProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const compactNumbers = Platform.OS !== 'web' || windowWidth <= 420;

  const displayName = user.displayName || user.id;

  const formatValue = (value: number) => {
    if (compactNumbers && Math.abs(value) >= 1000) return formatCompactNumber(value);
    return Math.round(value).toLocaleString();
  };

  return (
    <Pressable
      style={styles.userCard}
      onPress={() =>
        router.push(`/instructor/user-detail?userId=${user.id}`)
      }
    >
      <View style={styles.userCardHeader}>
        <View>
          <Text style={styles.userCardName}>{displayName}</Text>
          <Text style={styles.userCardId}>{user.id}</Text>
        </View>
        <Text style={styles.lastSync}>
          {overview?.lastSync
            ? `Last sync: ${new Date(overview.lastSync).toLocaleTimeString()}`
            : 'Last sync not found'}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Activity Stats */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Activity</Text>
          {overview?.todayActivity ? (
            <>
              <Text style={styles.statValue}>
                {formatValue(overview.todayActivity.steps || 0)} steps
              </Text>
              <Text style={styles.statSubValue}>
                {formatValue(overview.todayActivity.calories || 0)} cal
              </Text>
            </>
          ) : (
            <Text style={styles.noData}>No data</Text>
          )}
        </View>

        {/* Cardio Load */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cardio Load</Text>
          {overview?.todayCardioLoad ? (
            <Text style={styles.statValue}>
              {overview.todayCardioLoad.toFixed(2)}
            </Text>
          ) : (
            <Text style={styles.noData}>No data</Text>
          )}
        </View>

        {/* Sleep */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Sleep</Text>
          {overview?.todaySleep ? (
            <>
              <Text style={styles.statValue}>
                {overview.todaySleep.duration || 'N/A'}
              </Text>
              {overview.todaySleep.goalDiff && (
                <Text style={styles.statSubValue}>
                  {overview.todaySleep.goalDiff}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.noData}>No data</Text>
          )}
        </View>

        {/* Exercises */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>No. of Exercises (This month)</Text>
          <Text style={styles.statValue}>
            {overview?.totalMonthExercises || 0}
          </Text>
        </View>
      </View>

      <Text style={styles.viewDetails}>Tap to view details →</Text>
    </Pressable>
  );
};
