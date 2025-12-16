import { StyleSheet } from 'react-native';
import { white, black } from '@/constants/Colors';
import { Creature } from './types/polar';

export const getRarityColor = (type: Creature['rarity']) => {
  switch (type) {
  case 'rare': return '#43C073';
  case 'epic': return '#8B5CF6';
  case 'legendary': return '#F59E0B';
  default: return '#3BA8F6';
  }
};

export const getSportColor = (type: Creature['sport']) => {
  switch (type) {
    case 'RUNNING': return ['#AE0000', '#FFFFFF'];
    case 'SWIMMING': return ['#53E8f6', '#1F2937'];
    case 'HIKING': return ['#13780E', '#FFFFFF'];
    case 'FITNESS': return ['#FB008A', '#FFFFFF'];
    case 'CYCLING': return ['#FFF42A', '#1F2937'];
    case 'CIRCUIT': return ['#BB00FF', '#FFFFFF'];
    default: return ['#676767', '#FFFFFF'];
  }
};

// Home/Index Tab Styles
export const indexStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: white,
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  headerContainer: {
    marginBottom: 24,
    backgroundColor: white,
  },
  headerContent: {
    marginBottom: 16,
    backgroundColor: white,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 8,
    color: black,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'left',
    color: '#6B7280',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    marginTop: 12,
  },
  signOutText: {
    color: white,
    fontSize: 12,
    fontWeight: '600',
  },
  recentSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 16,
    color: black,
  },
});

// Creatures Tab (Two) Styles
export const twoStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 8,
  },
  stats: {
    fontSize: 14,
    textAlign: 'center',
    color: '#3B82F6',
    fontWeight: '600',
  },
  listContainer: {
    padding: 8,
  },
});

// Battle Tab Styles
export const battleStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 4,
    marginRight: 4,
    marginBottom: -8,
  },
  header: {
    padding: 8,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creatureIcon: { 
    width: 60, 
    height: 60, 
    resizeMode: 'contain', 
    imageRendering: 'pixelated' } as any,
  creatureIconContainer: {
    backgroundColor: '#FFFFFF',
    margin: 2,
    borderRadius: 12,
    borderWidth: 2
  },
  battleArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creature: {
    width: '50%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthBarContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    height: 20,
    marginTop: 4,
    marginRight: 64,
    marginLeft: 32,
  },
  emptyHealthBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderRadius: 4,
    backgroundColor: '#6B7280',
    height: '100%',
    width: '80%',
    maxWidth: 300,
    marginTop: 4,
  },
  healthBar: {
    borderRadius: 4,
    backgroundColor: '#10B981',
    height: '100%',
    width: '75%',
  },
  creatureStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    marginRight: 64,
    marginLeft: 32,
  },
  creatureName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: black,
    marginBottom: 4,
  },
  creatureRarity: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  creatureSportBadge: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: -4,
    marginLeft: 8,
  },
  creatureStat: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  specialContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  }
});

// Live Workout Tab Styles
export const liveStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: black,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
  },
  section: {
    backgroundColor: white,
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
    marginBottom: 12,
    color: black,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
  },
  scanButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: black,
  },
  devicesFoundText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  deviceItem: {
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
  deviceInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: black,
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  connectText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  connectedBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    flex: 1,
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: white,
    fontSize: 12,
    fontWeight: '600',
  },
  heartRateSection: {
    backgroundColor: white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  heartRateLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  heartRateDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
  },
  heartRateValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  heartRateUnit: {
    fontSize: 24,
    color: '#6B7280',
    marginLeft: 8,
  },
  heartIcon: {
    fontSize: 32,
    marginLeft: 12,
  },
  zoneIndicator: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoneText: {
    color: white,
    fontSize: 16,
    fontWeight: '600',
  },
  workoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
  workoutButtonText: {
    color: white,
    fontSize: 18,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  metricItem: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: black,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  summaryText: {
    fontSize: 14,
    color: black,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: black,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    paddingLeft: 8,
  },
  autoStartHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
  },
  resumeButton: {
    backgroundColor: '#10B981',
  },
  pauseReasonText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countdownBox: {
    backgroundColor: white,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
  },
  countdownLabel: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  workoutTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'transparent',
  },
  workoutTypeButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  workoutTypeButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#3B82F6',
  },
  workoutTypeText: {
    fontSize: 32,
    marginBottom: 8,
  },
  workoutTypeTextActive: {
    // No additional styles needed, just for consistency
  },
  workoutTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  workoutTypeLabelActive: {
    color: '#3B82F6',
  },
});

// XP Management Tab Styles
export const xpStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: black,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    backgroundColor: white,
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
    marginBottom: 12,
    color: black,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: white,
    fontSize: 12,
    fontWeight: '600',
  },
  xpDisplaySection: {
    backgroundColor: white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xpLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  xpDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  xpValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  xpUnit: {
    fontSize: 24,
    color: '#6B7280',
    marginLeft: 8,
  },
  xpIcon: {
    fontSize: 32,
    marginLeft: 12,
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: white,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: black,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#10B981',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: '600',
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAddButton: {
    width: '30%',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAddButtonText: {
    color: white,
    fontSize: 18,
    fontWeight: '600',
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: black,
    marginBottom: 12,
  },
  guideText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    paddingLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  progressInfo: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  attributesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  attributeBox: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  attributeLabel: {
    fontSize: 12,
    color: '#1E40AF',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '600',
  },
  attributeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: black,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  historyLeft: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  historyDate: {
    fontSize: 14,
    color: black,
    fontWeight: '600',
    marginBottom: 4,
  },
  historySport: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  historyRight: {
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
  },
  historyXP: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  creaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  creatureCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  creatureName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: black,
    marginBottom: 4,
  },
  creatureRarity: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  creatureSportBadge: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: -6,
  },
  creatureStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  creatureStat: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  showConsentButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  showConsentButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectPolarButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disconnectPolarButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: '600',
  },
});
