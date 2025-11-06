# QuestFit

A gamified fitness application that combines real-time workout tracking with RPG-style progression mechanics. **Now supports connecting to multiple Polar watches simultaneously!**

## 🆕 New Feature: Multi-Device Support

Connect multiple Polar watches via Bluetooth and track heart rates from multiple people at once! Perfect for:
- Team workouts
- Coaching sessions  
- Training with friends
- Family fitness

See [MULTI_DEVICE_GUIDE.md](MULTI_DEVICE_GUIDE.md) for detailed instructions.

## Project Structure

```
questfit/
├── app/                          # Expo Router app directory
│   ├── _layout.tsx              # Root layout component
│   ├── +html.tsx                # Custom HTML document
│   ├── +not-found.tsx           # 404 page
│   └── (tabs)/                  # Tab-based navigation group
│       ├── _layout.tsx          # Tabs layout
│       ├── index.tsx            # Home screen
│       ├── live.tsx             # Live workout tracking
│       ├── two.tsx              # Secondary tab
│       └── xp.tsx               # XP/progression screen
│
├── assets/                       # Static assets
│   ├── fonts/                   # Custom fonts
│   └── images/                  # Images and graphics
│
├── components/                   # Reusable React components
│   ├── Themed.tsx               # Themed component wrappers
│   ├── useClientOnlyValue.ts   # Client-side only values hook
│   ├── useColorScheme.ts       # Color scheme detection hook
│   ├── auth/
│   │   └── SignInScreen.tsx    # Authentication UI
│   ├── fitness/
│   │   └── WorkoutCard.tsx     # Workout display component
│   └── game/
│       ├── CreatureCard.tsx    # Game creature/character card
│       └── StatsDisplay.tsx    # Statistics display component
│
├── src/                          # Core application logic
│   ├── styles.ts                # Global styles
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts          # Authentication hook
│   │   ├── useGameProfile.ts   # Game profile management
│   │   ├── useLiveWorkout.ts   # Live workout tracking
│   │   └── useWorkoutSync.ts   # Workout synchronization
│   ├── services/                # External service integrations
│   │   ├── bluetoothService.ts # Bluetooth connectivity
│   │   ├── firebase.ts         # Firebase configuration
│   │   ├── gameService.ts      # Game mechanics logic
│   │   └── polarApi.ts         # Polar device API integration
│   ├── types/
│   │   └── polar.ts            # TypeScript types for Polar devices
│   └── utils/
│       ├── mockData.ts         # Mock data for testing
│       └── workoutProcessor.ts # Workout data processing
│
├── android/                      # Android native project
│   ├── app/
│   │   ├── build.gradle        # Android app build configuration
│   │   ├── google-services.json # Firebase Android config
│   │   └── src/
│   │       └── main/
│   │           ├── AndroidManifest.xml
│   │           ├── java/com/pika3113/questfit/
│   │           │   ├── MainActivity.kt
│   │           │   └── MainApplication.kt
│   │           └── res/        # Android resources
│   ├── build.gradle            # Android project build config
│   └── settings.gradle         # Android project settings
│
└── constants/
    └── Colors.ts               # App color definitions
```

## Core Files

### Configuration Files

- **`package.json`** - Node.js project configuration, dependencies, and scripts
- **`tsconfig.json`** - TypeScript compiler configuration
- **`babel.config.js`** - Babel transpiler configuration for React Native
- **`metro.config.js`** - Metro bundler configuration for React Native
- **`app.json`** - Expo app configuration (name, version, permissions, etc.)
- **`eas.json`** - Expo Application Services build configuration
- **`expo-env.d.ts`** - TypeScript environment declarations for Expo

### Firebase Configuration

- **`google-services.json`** - Firebase configuration for Android (root)
- **`GoogleService-Info.plist`** - Firebase configuration for iOS
- **`android/app/google-services.json`** - Firebase configuration for Android app

### Entry Points

- **`app/_layout.tsx`** - Root layout component defining the app's navigation structure
- **`app/(tabs)/index.tsx`** - Main home screen of the application
- **`app/(tabs)/live.tsx`** - Live workout tracking interface

### Core Services

- **`src/services/firebase.ts`** - Firebase initialization and configuration
- **`src/services/bluetoothService.ts`** - Handles Bluetooth connections to fitness devices
- **`src/services/polarApi.ts`** - Integration with Polar heart rate monitors and fitness devices
- **`src/services/gameService.ts`** - Game mechanics and progression logic

### Key Hooks

- **`src/hooks/useAuth.ts`** - Authentication state management
- **`src/hooks/useGameProfile.ts`** - User's game profile and stats management
- **`src/hooks/useLiveWorkout.ts`** - Real-time workout tracking logic
- **`src/hooks/useWorkoutSync.ts`** - Syncs workout data with backend/storage

### Utilities

- **`src/utils/workoutProcessor.ts`** - Processes and analyzes workout data (heart rate, calories, etc.)
- **`src/utils/mockData.ts`** - Mock data for development and testing

### Native Android

- **`android/app/src/main/java/com/pika3113/questfit/MainActivity.kt`** - Android main activity
- **`android/app/src/main/java/com/pika3113/questfit/MainApplication.kt`** - Android application class
- **`android/app/src/main/AndroidManifest.xml`** - Android app manifest with permissions

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **TypeScript** - Type-safe JavaScript
- **Firebase** - Backend services (authentication, database, storage)
- **Polar SDK** - Integration with Polar fitness devices
- **Bluetooth** - Heart rate monitor connectivity
