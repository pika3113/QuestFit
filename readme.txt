# QuestFit - Gamified Fitness Tracker

This project integrates with the Polar Watch API to transform real-world physical training into an engaging, game-like experience. By tracking metrics such as heart rate, distance, and activity duration, users can "catch" virtual creatures, unlock rewards, and explore new levels based on their workout performance. The app gamifies fitness by blending data-driven training with interactive gameplay, motivating users to stay active and consistent through real-time feedback and progression tied directly to their Polar workouts.

## Features

🏃‍♂️ **Workout Tracking**: Real-time integration with Polar Watch API
🎯 **Creature Collection**: Catch virtual creatures based on workout performance
📊 **Progress Tracking**: Level up system with experience points
🗺️ **Map Integration**: Route visualization with creature spawn locations
🏆 **Achievements**: Unlock badges and rewards for fitness milestones
📱 **Cross-Platform**: Built with React Native and Expo

## Tech Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router
- **UI Components**: React Native Paper
- **Maps**: React Native Maps
- **Animations**: Lottie React Native
- **Backend**: Firebase (Firestore, Auth, Storage)
- **API Integration**: Axios for Polar API
- **Language**: TypeScript

## Dependencies

```json
{
  "axios": "^1.12.2",
  "firebase": "^12.4.0",
  "lottie-react-native": "^7.3.4",
  "react-native-maps": "^1.26.17",
  "react-native-paper": "^5.x.x",
  "expo": "~54.0.18",
  "expo-router": "~6.0.13",
  "react": "19.1.0",
  "react-native": "0.81.5"
}
```

## Project Structure

```
questfit/
├── app/                    # Expo Router pages
│   ├── (tabs)/
│   │   ├── index.tsx      # Home screen with stats
│   │   └── two.tsx        # Creatures collection
│   └── _layout.tsx        # Root layout
├── components/             # Reusable UI components
│   ├── game/              # Game-specific components
│   │   ├── CreatureCard.tsx
│   │   └── StatsDisplay.tsx
│   ├── fitness/           # Fitness-related components
│   │   └── WorkoutCard.tsx
│   └── ui/                # General UI components
│       └── WorkoutMap.tsx
├── src/
│   ├── services/          # API and external services
│   │   ├── polarApi.ts    # Polar Watch API integration
│   │   ├── firebase.ts    # Firebase configuration
│   │   └── gameService.ts # Game logic and data management
│   ├── hooks/             # Custom React hooks
│   │   ├── useGameProfile.ts
│   │   └── useWorkoutSync.ts
│   ├── types/             # TypeScript type definitions
│   │   └── polar.ts
│   └── utils/             # Utility functions
│       ├── workoutProcessor.ts
│       └── mockData.ts
├── assets/                # Static assets
│   ├── images/           # App icons and images
│   ├── animations/       # Lottie animation files
│   └── creatures/        # Creature artwork
└── constants/            # App-wide constants
    └── Colors.ts
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   - Create a Firebase project
   - Update `src/services/firebase.ts` with your config
   - Set up Firestore collections: `users`, `workoutSessions`, `creatures`
   - Enable Google Sign-In in Firebase Authentication

3. **Enable Google Sign-In in Firebase**:
   - Go to Firebase Console → Authentication
   - Enable Google sign-in provider
   - Add your app's OAuth credentials

4. **Configure Polar API**:
   - Register your app with Polar AccessLink
   - Update API credentials in environment variables

5. **Run the app**:
   ```bash
   npx expo start
   ```

## Authentication Flow

The app uses Firebase Authentication with Google Sign-In:

1. **First Load**: Users see the sign-in screen with Google authentication
2. **Sign In**: Users tap "Sign In with Google" button
3. **Session Persistence**: Auth state is persisted using AsyncStorage
4. **Auto Login**: Returning users are automatically logged in
5. **Sign Out**: Users can sign out from the home screen

## Game Mechanics

### Creature Collection
- Creatures are unlocked by completing specific workout requirements
- Rarity levels: Common, Rare, Epic, Legendary
- Each creature has unique stats: Power, Speed, Endurance

### Experience System
- Gain XP based on workout intensity, duration, and performance
- Level up to unlock new creatures and features
- Achievements for reaching milestones

### Workout Integration
- Real-time sync with Polar Watch data
- Automatic reward calculation based on performance
- Map visualization of workout routes with creature spawn points

## Future Features

- [ ] Multiplayer challenges and leaderboards
- [ ] AR creature catching using device camera
- [ ] Custom workout programs tied to specific creatures
- [ ] Social features and team competitions
- [ ] Wearable device integration beyond Polar
- [ ] Nutrition tracking integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

