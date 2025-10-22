# Building QuestFit with Bluetooth Support

## ⚠️ Important: Bluetooth Requires Development Build

The Bluetooth LE features **will NOT work in Expo Go** because `react-native-ble-plx` requires native modules that aren't included in the Expo Go app.

You have two options:

---

## Option 1: Create a Development Build (Recommended)

This creates a custom version of your app with all native modules included.

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
```

### Step 3: Configure EAS Build
```bash
eas build:configure
```

### Step 4: Build for Android
```bash
# For physical device or emulator
eas build --profile development --platform android

# Or build locally (faster, requires Android Studio)
eas build --profile development --platform android --local
```

### Step 5: Install the Build
Once the build completes, download and install the `.apk` file on your Android device or emulator.

### Step 6: Start Development Server
```bash
npx expo start --dev-client
```

Now scan the QR code with your development build app, and Bluetooth will work!

---

## Option 2: Build Standalone APK

For a production-ready app:

```bash
# Build for Android
eas build --profile production --platform android

# Build for iOS
eas build --profile production --platform ios
```

---

## Testing Bluetooth Features

Once you have a development build installed:

1. **Enable Bluetooth** on your device
2. **Turn on your Polar watch** (H10, H9, OH1, or Verity Sense)
3. Open the **Live Workout** tab in QuestFit
4. Tap **"Scan for Polar Devices"**
5. Select your device from the list
6. Start your workout and see real-time heart rate!

---

## Troubleshooting

### "Cannot read property 'createClient' of null"
- This error appears when using Expo Go
- Solution: Build a development build (see Option 1 above)

### "Bluetooth permissions denied"
- Make sure to grant Bluetooth and Location permissions when prompted
- On Android 12+, both Bluetooth and Location permissions are required

### "No devices found"
- Make sure your Polar watch is on and in pairing mode
- Ensure Bluetooth is enabled on your phone
- Try moving closer to the device

### Device connection fails
- Make sure the device isn't already connected to another app
- Try turning Bluetooth off and on
- Restart your Polar watch

---

## Local Development Setup

If you want to build locally without EAS:

### Android
```bash
# Make sure Android Studio is installed
npx expo run:android
```

### iOS (macOS only)
```bash
# Make sure Xcode is installed
npx expo run:ios
```

---

## Alternative: Use Polar API (Cloud)

If you don't want to deal with Bluetooth, you can continue using the **Polar API** tab which uses the cloud API and works in Expo Go:

1. Get an access token from Polar AccessLink
2. Paste it in the Polar API tab
3. Fetch workout data after you finish exercising

This method doesn't require a development build but also doesn't provide real-time data during workouts.

---

## Questions?

- [Expo Development Builds Documentation](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [react-native-ble-plx GitHub](https://github.com/dotintent/react-native-ble-plx)
