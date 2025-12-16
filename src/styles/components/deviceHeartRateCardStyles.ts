import { StyleSheet } from 'react-native';

export const deviceHeartRateCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    color: '#64748B',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  hrSection: {
    alignItems: 'center',
  },
  hrDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  hrValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginRight: 8,
  },
  hrUnit: {
    fontSize: 18,
    color: '#475569',
    marginRight: 8,
  },
  heartIcon: {
    fontSize: 24,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  accentStripCompact: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactDeviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  compactDisconnectButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  compactDisconnectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  compactHRContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  compactHR: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 6,
  },
  compactBPM: {
    fontSize: 14,
    color: '#475569',
  },
});
