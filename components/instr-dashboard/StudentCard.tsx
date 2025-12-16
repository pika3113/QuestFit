import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, useWindowDimensions, Platform, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Sparkline from './Sparkline';
import { SkeletonBlock } from '@/components/Skeleton';
import { formatCompactNumber } from '@/src/utils/numberFormat';

export interface StudentStats {
  id: string;
  displayName: string;
  photoURL?: string;
  lastSync?: string;
  lastChecked?: string;
  
  // History arrays (7 days)
  hrHistory: number[];
  distanceHistory: number[];
  stepsHistory: number[];
  sleepHistory: number[];
  caloriesHistory: number[];
  labels: string[];

  // Averages
  avgHr: number;
  avgDistance: number;
  avgSteps: number;
  avgSleep: number;
  avgCalories: number;
  
  trend: 'up' | 'down' | 'stable';
}

export type ChartType = 'line' | 'bar' | 'area' | 'scatter';

export type CadetFlag = 'good' | 'bad' | 'none';
export type CadetFlagSource = 'manual' | 'ai' | 'none';

interface StudentCardProps {
  item: StudentStats;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  chartConfig?: Record<MetricType, ChartType>;
  activityMetric?: 'steps' | 'distance';
  rangeDays?: number;
  flag?: CadetFlag;
  flagSource?: CadetFlagSource;
  onChangeFlag?: (flag: CadetFlag) => void;
}

type MetricType = 'hr' | 'distance' | 'sleep' | 'calories';

function formatLastSync(value: string | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${dd}/${mm}/${yyyy} ${hours}:${minutes} ${ampm}`;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
  item, 
  isSelectionMode = false, 
  isSelected = false, 
  onToggleSelection,
  chartConfig = { hr: 'line', distance: 'bar', sleep: 'line', calories: 'area' },
  activityMetric = 'steps',
  rangeDays,
  flag = 'none',
  flagSource = 'none',
  onChangeFlag,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('distance');
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  const isCompactViewport = windowHeight <= 760;
  const collapsedChartHeight = isCompactViewport ? 210 : 270;

  const chartDaysLabel = (() => {
    const days = typeof rangeDays === 'number' && Number.isFinite(rangeDays) ? Math.max(1, Math.round(rangeDays)) : 7;
    return days === 1 ? 'Last 1 Day' : `Last ${days} Days`;
  })();
  const isNarrowScreen = windowWidth <= 420;
  const compactNumbers = Platform.OS !== 'web' || isNarrowScreen;

  const isCompactHeader = Platform.OS === 'android' || windowWidth <= 380;
  const thumbIconSize = isCompactHeader ? 12 : 16;
  const trendIconSize = isCompactHeader ? 18 : 24;
  const flagIconSize = isCompactHeader ? 14 : 18;
  const sparklesIconSize = isCompactHeader ? 12 : 16;

  const formatMobileCompact = (value: number) => {
    if (compactNumbers && typeof value === 'number' && Number.isFinite(value) && Math.abs(value) >= 1000) {
      return formatCompactNumber(value);
    }
    return Math.round(value).toLocaleString();
  };

  const expandedModalMaxWidth = Platform.OS === 'web' ? 1200 : 720;
  const expandedModalTargetWidth = Platform.OS === 'web' ? windowWidth * 0.92 : windowWidth - 40;
  const expandedModalWidth = Math.max(320, Math.min(expandedModalTargetWidth, expandedModalMaxWidth));
  const expandedChartHeight = Math.round(Math.min(420, Math.max(260, windowHeight * 0.5)));

  const handlePress = () => {
    if (isChartExpanded) return;
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(item.id);
    } else {
      router.push({ pathname: '/instructor/user-detail', params: { userId: item.id } });
    }
  };

  const getChartData = () => {
    switch (selectedMetric) {
      case 'hr': return item.hrHistory;
      case 'distance': return activityMetric === 'steps' ? item.stepsHistory : item.distanceHistory;
      case 'sleep': return item.sleepHistory;
      case 'calories': return item.caloriesHistory;
      default: return activityMetric === 'steps' ? item.stepsHistory : item.distanceHistory;
    }
  };

  const getChartColor = () => {
    switch (selectedMetric) {
      case 'hr': return 'rgba(255, 107, 53, 1)'; // Orange
      case 'distance': return 'rgba(46, 134, 171, 1)'; // Blue
      case 'sleep': return 'rgba(162, 59, 114, 1)'; // Purple
      case 'calories': return 'rgba(253, 203, 110, 1)'; // Yellow
      default: return 'rgba(46, 134, 171, 1)';
    }
  };

  const getChartLabel = () => {
    switch (selectedMetric) {
      case 'hr': return 'Avg Heart Rate (bpm)';
      case 'distance': return activityMetric === 'steps' ? 'Steps' : 'Distance (m)';
      case 'sleep': return 'Sleep Score';
      case 'calories': return 'Active Calories';
      default: return '';
    }
  };

  const data = getChartData();
  const safeData = data.length > 0
    ? data
    : (item.labels?.length ? new Array(item.labels.length).fill(0) : [0]);

  const trendIcon = (
    item.trend === 'up'
      ? <Ionicons name="trending-up" size={trendIconSize} color="#00B894" />
      : item.trend === 'down'
        ? <Ionicons name="trending-down" size={trendIconSize} color="#D63031" />
        : <Ionicons name="remove" size={trendIconSize} color="#636E72" />
  );

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isCompactViewport && { padding: 12, marginBottom: 12 },
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
      disabled={isChartExpanded}
    >
      <View style={[styles.cardHeader, isCompactViewport && { marginBottom: 12 }]}>
        <View style={styles.userInfo}>
          {isSelectionMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
          )}
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{item.displayName}</Text>
            <Text style={styles.lastSync}>Last Sync: {formatLastSync(item.lastSync)}</Text>
            <Text style={styles.lastSync}>Last Checked: {formatLastSync(item.lastChecked)}</Text>
          </View>
        </View>
        <View
          style={[
            styles.trendContainer,
            isCompactHeader && { flexDirection: 'column', alignItems: 'center', gap: 6, padding: 6 },
          ]}
        >
          {isCompactHeader && (
            <View style={styles.trendIconBlock}>
              {trendIcon}
            </View>
          )}

          {isCompactHeader && <View style={styles.trendDividerHorizontal} />}

          <View style={styles.flagBlock}>
            {!!onChangeFlag && !isSelectionMode ? (
              <View style={styles.flagActionsRow}>
                <TouchableOpacity
                  style={[styles.flagActionBtn, flag === 'good' && styles.flagActionBtnActiveGood]}
                  onPress={() => onChangeFlag(flag === 'good' ? 'none' : 'good')}
                  accessibilityRole="button"
                  accessibilityLabel={flag === 'good' ? 'Unflag good' : 'Flag good'}
                >
                  <View style={styles.flagIconWrap}>
                    <Ionicons name="thumbs-up" size={thumbIconSize} color="#00B894" />
                    {flag === 'good' && flagSource === 'ai' && (
                      <Ionicons
                        name="sparkles"
                        size={Math.max(10, sparklesIconSize - 4)}
                        color="#636E72"
                        style={styles.aiBadge}
                        accessibilityLabel="AI flagged"
                      />
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.flagActionBtn, flag === 'bad' && styles.flagActionBtnActiveBad]}
                  onPress={() => onChangeFlag(flag === 'bad' ? 'none' : 'bad')}
                  accessibilityRole="button"
                  accessibilityLabel={flag === 'bad' ? 'Unflag needs attention' : 'Flag needs attention'}
                >
                  <View style={styles.flagIconWrap}>
                    <Ionicons name="thumbs-down" size={thumbIconSize} color="#D63031" />
                    {flag === 'bad' && flagSource === 'ai' && (
                      <Ionicons
                        name="sparkles"
                        size={Math.max(10, sparklesIconSize - 4)}
                        color="#636E72"
                        style={styles.aiBadge}
                        accessibilityLabel="AI flagged"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {flag === 'good' && <Ionicons name="thumbs-up" size={flagIconSize} color="#00B894" />}
                {flag === 'bad' && <Ionicons name="thumbs-down" size={flagIconSize} color="#D63031" />}
                {flag !== 'none' && flagSource === 'ai' && <Ionicons name="sparkles" size={sparklesIconSize} color="#636E72" />}
              </>
            )}
          </View>

          {!isCompactHeader && <View style={styles.trendDividerVertical} />}

          {!isCompactHeader && (
            <View style={styles.trendIconBlock}>
              {trendIcon}
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid - Clickable to switch chart */}
      <View style={[styles.statsGrid, isCompactViewport && { marginBottom: 12 }]}>
        <TouchableOpacity 
          style={[styles.statItem, selectedMetric === 'distance' && styles.statItemActive]}
          onPress={() => setSelectedMetric('distance')}
        >
          <Ionicons name="walk" size={14} color="#2E86AB" />
          <Text style={styles.statValue}>
            {formatMobileCompact(activityMetric === 'steps' ? item.avgSteps : item.avgDistance)}
          </Text>
          <Text style={styles.statLabel}>{activityMetric === 'steps' ? 'Steps' : 'Dist (m)'}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statItem, selectedMetric === 'hr' && styles.statItemActive]}
          onPress={() => setSelectedMetric('hr')}
        >
          <Ionicons name="heart" size={14} color="#FF6B35" />
          <Text style={styles.statValue}>{item.avgHr > 0 ? item.avgHr : '-'}</Text>
          <Text style={styles.statLabel}>BPM</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statItem, selectedMetric === 'sleep' && styles.statItemActive]}
          onPress={() => setSelectedMetric('sleep')}
        >
          <Ionicons name="moon" size={14} color="#A23B72" />
          <Text style={styles.statValue}>{item.avgSleep > 0 ? item.avgSleep : '-'}</Text>
          <Text style={styles.statLabel}>Sleep</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statItem, selectedMetric === 'calories' && styles.statItemActive]}
          onPress={() => setSelectedMetric('calories')}
        >
          <Ionicons name="flame" size={14} color="#FDCB6E" />
          <Text style={styles.statValue}>{formatMobileCompact(item.avgCalories)}</Text>
          <Text style={styles.statLabel}>Kcal</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartContainer}>
        <Text style={[styles.chartLabel, isCompactViewport && { marginBottom: 6 }]}>{getChartLabel()} ({chartDaysLabel})</Text>
        <TouchableOpacity 
          onPress={() => setIsChartExpanded(true)}
          activeOpacity={0.8}
          style={{ width: '100%' }}
        >
          <View style={{ height: collapsedChartHeight, width: '100%', overflow: 'hidden', borderRadius: 16 }}>
            <Sparkline 
              data={safeData}
              labels={item.labels}
              color={getChartColor()} 
              height={collapsedChartHeight}
              type={chartConfig[selectedMetric]}
              compactNumbers={compactNumbers}
            />
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isChartExpanded}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsChartExpanded(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsChartExpanded(false)}>
          <View
            style={[styles.expandedChartContainer, { width: expandedModalWidth, maxWidth: expandedModalWidth }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.expandedHeader}>
              <View>
                <Text style={styles.expandedTitle}>{item.displayName}</Text>
                <Text style={styles.expandedSubtitle}>{getChartLabel()}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsChartExpanded(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={32} color="#636E72" />
              </TouchableOpacity>
            </View>
            <View style={{ height: expandedChartHeight, width: '100%', marginTop: 20 }}>
              <Sparkline 
                data={safeData}
                labels={item.labels}
                color={getChartColor()} 
                height={expandedChartHeight}
                type={chartConfig[selectedMetric]}
                compactNumbers={compactNumbers}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
};

export function StudentCardSkeleton() {
  const { height: windowHeight } = useWindowDimensions();
  const isCompactViewport = windowHeight <= 760;
  const collapsedChartHeight = isCompactViewport ? 210 : 270;

  return (
    <View style={[styles.card, isCompactViewport && { padding: 12, marginBottom: 12 }]}>
      <View style={[styles.cardHeader, isCompactViewport && { marginBottom: 12 }]}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <SkeletonBlock width={44} height={44} radius={22} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonBlock width={160} height={14} radius={6} style={{ marginTop: 4 }} />
            <SkeletonBlock width={220} height={12} radius={6} style={{ marginTop: 10 }} />
          </View>
        </View>
        <SkeletonBlock width={24} height={24} radius={12} />
      </View>

      <View style={[styles.statsGrid, isCompactViewport && { marginBottom: 12 }]}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View key={idx} style={styles.statItem}>
            <SkeletonBlock width={18} height={18} radius={9} />
            <SkeletonBlock width={'70%'} height={16} radius={6} style={{ marginTop: 10 }} />
            <SkeletonBlock width={'45%'} height={10} radius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      <View style={styles.chartContainer}>
        <SkeletonBlock width={220} height={12} radius={6} />
        <View
          style={{
            height: collapsedChartHeight,
            width: '100%',
            overflow: 'hidden',
            borderRadius: 16,
            marginTop: 10,
            backgroundColor: '#E0E0E0',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF5F0',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatar: {
    width: 48,
    height: 48,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
  },
  lastSync: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  trendContainer: {
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendIconBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendDividerVertical: {
    width: 2,
    height: 22,
    backgroundColor: '#D1D5DB',
  },
  trendDividerHorizontal: {
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: '#D1D5DB',
  },
  flagActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flagIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  flagActionBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 8,
  },
  flagActionBtnActiveGood: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B894',
  },
  flagActionBtnActiveBad: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D63031',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 8,
  },
  statItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 9,
    color: '#636E72',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartLabel: {
    fontSize: 12,
    color: '#B2BEC3',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  expandedChartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  expandedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  expandedSubtitle: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
});
