# Multi-Device Polar Watch Support

## Overview
The app now supports connecting to multiple Polar watches simultaneously via Bluetooth and displaying their heart rates in real-time.

## Key Changes

### 1. Updated Bluetooth Service (`src/services/bluetoothService.ts`)
- **Multi-device support**: Changed from single `connectedDevice` to `connectedDevices` Map
- **Device tracking**: Each device has its own `ConnectedDeviceInfo` object containing:
  - Device instance
  - Current heart rate
  - Last heart rate time
  - Heart rate readings history
- **Enhanced interfaces**:
  - `HeartRateReading` now includes `deviceId` and `deviceName`
  - New `ConnectedDeviceInfo` interface for device state management
- **New methods**:
  - `getConnectedDevices()` - Get all connected devices
  - `getConnectedDevice(deviceId)` - Get specific device info
  - `disconnectDevice(deviceId)` - Disconnect individual device
  - Updated `disconnect()` - Disconnect all devices
- **Aggregated metrics**: Workout metrics now aggregate data from all connected devices

### 2. New Multi-Device Hook (`src/hooks/useMultiDeviceWorkout.ts`)
- Similar API to `useLiveWorkout` but supports multiple devices
- **State management**:
  - `connectedDevices` - Array of connected device info
  - `deviceHeartRates` - Map of device IDs to current heart rates
- **New actions**:
  - `disconnectDevice(deviceId)` - Disconnect single device
  - `disconnectAll()` - Disconnect all devices
- **Auto-pause**: Pauses workout if no heart rate data received for 5 seconds from any device
- **Auto-start**: Starts workout countdown when first heart rate is detected

### 3. New Device Heart Rate Card Component (`components/fitness/DeviceHeartRateCard.tsx`)
- Displays individual device information and heart rate
- **Two modes**:
  - **Normal mode**: Full card with device name, ID, heart rate, and last update time
  - **Compact mode**: Smaller card for when multiple devices are connected (3+ devices)
- **Color-coded heart rates**:
  - Gray: No data
  - Blue: < 100 bpm
  - Green: 100-120 bpm
  - Yellow: 120-140 bpm
  - Orange: 140-160 bpm
  - Red: > 160 bpm
- Per-device disconnect button

### 4. New Multi-Device Screen (`app/(tabs)/multi-device-live.tsx`)
- Complete UI for managing multiple Polar watch connections
- **Features**:
  - Connect/disconnect individual devices
  - "Disconnect All" button for quick cleanup
  - Individual heart rate displays for each connected device
  - Team average heart rate calculation
  - Same workout tracking features as single-device mode
  - Filters already-connected devices from scan results
- **Team metrics**: When 2+ devices connected, shows team average heart rate with team icon (👥❤️)

### 5. Updated Tab Navigation (`app/(tabs)/_layout.tsx`)
- Added new "Multi-Device" tab with users icon
- Preserves existing "Live Workout" tab for single-device use

## Preserved Functionality

### Old Single-Device Mode Still Works
- `useLiveWorkout` hook unchanged and fully functional
- Original `live.tsx` screen still available
- Backward compatible - old code continues to work

## Usage

### Single Device (Original)
1. Go to "Live Workout" tab
2. Scan for devices
3. Connect to one Polar watch
4. Start workout

### Multiple Devices (New)
1. Go to "Multi-Device" tab
2. Scan for devices
3. Connect to multiple Polar watches (one at a time)
4. Each device shows its own heart rate
5. Start workout to track all devices together
6. Team average shown when 2+ devices connected
7. Can disconnect individual devices or all at once

## Technical Details

### Data Flow
1. Each device monitors its own heart rate characteristic
2. Heart rate readings include `deviceId` and `deviceName`
3. All readings passed to listeners (hooks subscribe)
4. Hook updates `deviceHeartRates` Map with latest values
5. UI re-renders with new heart rates for each device

### Workout Metrics
- Aggregates readings from ALL connected devices
- Average/max/min HR calculated across all devices
- Duration and calories use combined data
- Zone calculation based on team average

### Performance
- Devices update independently
- State updates batched by React
- Efficient Map-based device lookup
- Minimal re-renders with proper React hooks dependencies

## Files Modified
- ✅ `src/services/bluetoothService.ts` - Multi-device support
- ✅ `app/(tabs)/_layout.tsx` - Added multi-device tab

## Files Created
- ✅ `src/hooks/useMultiDeviceWorkout.ts` - Multi-device hook
- ✅ `components/fitness/DeviceHeartRateCard.tsx` - Device display component
- ✅ `app/(tabs)/multi-device-live.tsx` - Multi-device screen
- ✅ `MULTI_DEVICE_CHANGES.md` - This document

## Testing Recommendations
1. Test with 1 device (should work like single-device mode)
2. Test with 2 devices (team average should appear)
3. Test with 3+ devices (compact cards should activate)
4. Test disconnecting individual devices during workout
5. Test "Disconnect All" functionality
6. Verify workout metrics aggregate correctly
7. Test auto-pause when devices lose connection
8. Verify old single-device screen still works

## Future Enhancements
- Device nicknames/labels
- Per-device workout stats
- Device battery level indicators
- Historical comparison between devices
- Export multi-device workout data
- Device-specific heart rate zones
