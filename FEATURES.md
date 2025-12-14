# QuestFit Features

## 🎮 Gamification System

### XP & Leveling
- **Dynamic XP Calculation**: Earn experience points based on workout metrics
  - Calories burned: 0.1 XP per calorie
  - Distance covered: 5 XP per km
  - Workout duration: 0.5 XP per minute
  - Heart rate bonus: +10 XP when HR data is available
- **Progressive Leveling**: Level up system with increasing XP requirements
- **Real-time Progress Tracking**: Live updates of XP and level advancement
- **Workout History**: View past workouts and total stats (calories, workouts, etc.)

### Creature Collection System
- **10+ Unique Creatures**: Collectible creatures with different rarities and unlock requirements
- **Challenge-Based Unlocks**: Each creature has specific workout requirements:
  - Minimum calories burned
  - Minimum distance traveled
  - Minimum workout duration
  - Minimum average heart rate
  - Specific sport types (running, cycling, etc.)
- **Bonus XP Rewards**: Unlock creatures to earn bonus experience points
- **Visual Collection Gallery**: Browse all creatures, see which you've captured, and view unlock requirements
- **Rarity System**: Creatures categorized by rarity (Common, Uncommon, Rare, Epic, Legendary)
- **Unlock Celebration**: Beautiful modal with creature stats when unlocking new creatures

### Data Files
- Creature data available in both JSON and CSV formats (`data/creatures.json`, `data/creatures.csv`)
- Easy to extend and modify creature requirements

---

## 🏃 Workout Tracking

### Live Workout Features
- **Real-time Heart Rate Monitoring**: Connect to Polar devices via Bluetooth for live HR tracking
- **Multi-Metric Tracking**: Monitor multiple workout metrics simultaneously:
  - Heart rate (BPM)
  - Calories burned
  - Distance traveled
  - Workout duration
  - Average/max heart rate
- **Visual Feedback**: Real-time graphs and displays of workout metrics
- **Workout Completion**: End workout and immediately see results, XP gained, and creatures unlocked

### Multi-Device Support 🆕
- **Simultaneous Device Tracking**: Connect and monitor multiple Polar watches at once
- **Group Workouts**: Perfect for:
  - Team training sessions
  - Coaching multiple clients
  - Family fitness activities
  - Group classes
- **Instructor Dashboard**: Special view for trainers to monitor all participants
  - Individual heart rates for each participant
  - Group average metrics
  - Active participants count
  - Real-time connection status

### Polar Integration
- **Cloud Sync**: Automatic synchronization with Polar Flow cloud service
- **OAuth Authentication**: Secure connection to Polar account
- **Webhook Integration**: Real-time workout data sync from Polar devices
- **Background Sync**: Daily automated sync of workout data (2 AM UTC)
- **Workout History Import**: Access all historical workout data from Polar account

---

## 🔐 Authentication & User Management

### Authentication Options
- Firebase Authentication integration
- User profile management
- Secure sign-in/sign-out

### User Profile
- Personal stats dashboard
- Total XP and current level
- Total workouts completed
- Total calories burned
- Workout history timeline
- Captured creatures collection

---

## 📱 User Interface

### Screen Structure
1. **Home Tab** (`Home.tsx`)
   - Dashboard overview
   - Quick access to features
   - User stats summary

2. **Workout Tab** (`workout.tsx`)
   - Live workout tracking
   - Start/stop workout controls
   - Real-time metrics display
   - Bluetooth device connection

3. **Creatures Tab** (`creatures.tsx`)
   - Browse all available creatures
   - View captured creatures
   - See unlock requirements
   - Filter by rarity

4. **Profile Tab** (`me.tsx`)
   - User statistics
   - Level and XP progress
   - Workout history
   - Account settings

5. **Instructor Dashboard** (`instr-dashboard.tsx`)
   - Multi-device monitoring
   - Group workout management
   - Real-time participant metrics

### UI Components
- **WorkoutCard**: Display workout summaries with metrics
- **CreatureCard**: Show creature details, stats, and rarity
- **CreatureUnlockModal**: Celebration animation when unlocking creatures
- **StatsDisplay**: Visual representation of user statistics
- **DeviceHeartRateCard**: Real-time heart rate display for connected devices
- **PolarLinkScreen**: Polar account connection interface
- **DebugConsole**: Development debugging tools

---

## 🔧 Technical Features

### Platform Support
- **iOS**: Full native support
- **Android**: Full native support
- **Web**: Progressive Web App (PWA) support via Vercel deployment

### Real-time Features
- Firebase real-time database sync
- Bluetooth Low Energy (BLE) streaming
- Live workout metric updates
- Instant creature unlock notifications

### State Management
- Custom React Hooks for business logic:
  - `useAuth`: Authentication state management
  - `useGameProfile`: User profile and game data
  - `useLiveWorkout`: Live workout tracking
  - `useMultiDeviceWorkout`: Multi-device connection management
  - `useWorkoutSync`: Workout data synchronization
  - `useCreatureUnlock`: Creature unlock logic

### Services Layer
- **bluetoothService.ts**: BLE device connection and communication
- **creatureService.ts**: Creature data management and unlock logic
- **gameService.ts**: Game mechanics and progression
- **heartRateTrackingService.ts**: Heart rate monitoring
- **polarApi.ts**: Polar API integration
- **polarOAuthService.ts**: Polar OAuth flow handling
- **workoutCompletionService.ts**: Workout processing and rewards

### API Endpoints (Vercel Serverless Functions)
- `POST /api/polar/register-user`: Register user with Polar
- `POST /api/polar/webhook`: Receive Polar workout webhooks (HMAC-verified via `POLAR_WEBHOOK_SIGNATURE_SECRET`)
- `GET /api/polar/user-data`: Fetch user data from Polar
- `POST /api/polar/create-webhook`: Create Polar webhook
- `DELETE /api/polar/delete-webhook`: Remove Polar webhook
- `POST /api/polar/disconnect-user`: Disconnect Polar account
- `GET /api/cron/daily-polar-sync`: Daily background sync (automated)

---

## 📊 Data & Analytics

### Workout Metrics Tracked
- Duration (minutes/hours)
- Distance (kilometers)
- Calories burned
- Average heart rate
- Maximum heart rate
- Sport/activity type

### Game Progress Metrics
- Current level
- Total XP earned
- XP to next level
- Number of creatures captured
- Total workouts completed
- Total calories burned
- Workout completion rate

### Creature Statistics
- Unlock timestamp
- Unlock workout details
- Bonus XP earned from unlock
- Rarity tier
- Unlock requirements met

---

## 🔄 Background Processing

### Automated Sync
- Daily cron job at 2 AM UTC
- Fetches workouts from last 24 hours
- Processes workout data automatically
- Awards XP and creature unlocks retroactively
- Error handling and retry logic

### Webhook Integration
- Real-time workout completion notifications from Polar
- Instant data sync when workout is saved in Polar Flow
- Automatic XP calculation and creature checks
- Push notifications support (future enhancement)

---

## 🛠️ Development Features

### Testing & Debugging
- Test screen (`test.tsx`) for feature testing
- Mock data utilities for development
- Debug console component
- Workout completion examples
- Test script for Polar sync (`scripts/test-polar-sync.js`)

### Configuration
- TypeScript strict mode enabled
- Babel configuration for React Native
- Metro bundler optimization
- Expo dev client for custom native code
- EAS Build configuration for app deployment

### Code Organization
- Clean architecture with separation of concerns
- Reusable hooks for business logic
- Service layer for external integrations
- Type-safe with TypeScript
- Modular component structure

---

## 🚀 Deployment

### Web Deployment
- Vercel integration with `vercel.json`
- Static export support
- Serverless API functions
- Environment variable management
- Analytics integration (@vercel/analytics)

### Mobile Deployment
- Expo Application Services (EAS) configured
- Build profiles for development, preview, and production
- Google Services integration (Firebase)
- Native permissions configured (Bluetooth, Location)

---

## 🔐 Security & Privacy

### Data Security
- Firebase security rules enforcement
- OAuth 2.0 for Polar integration
- Secure token storage
- User data encryption in transit

### Permissions
- Bluetooth access for device connectivity
- Location access for workout tracking (optional)
- Internet access for cloud sync
- Camera access (future: profile pictures)

---

## 📈 Future Enhancements

### Planned Features
- Social features (friends, leaderboards, challenges)
- Push notifications for workout reminders and achievements
- Additional wearable device integrations (Garmin, Fitbit, Apple Watch)
- Custom workout programs and training plans
- Achievement badges and milestones
- Creature evolution/upgrade system
- Multiplayer challenges and competitions
- AR creature visualization
- Voice coaching during workouts
- Integration with nutrition tracking

### Under Consideration
- Apple HealthKit integration
- Google Fit integration
- Strava sync
- Advanced analytics and insights
- Coaching/PT marketplace
- Community workout sharing
- Custom creature creation
- Seasonal events and limited-time creatures

---

## 📝 Version Information

- **Version**: 1.0.0
- **License**: 0BSD
- **Platform**: React Native (Expo)
- **Minimum Requirements**: 
  - iOS 13.0+
  - Android 6.0+
  - Node.js 18+

---

## 🎯 Key Selling Points

1. **Gamification Done Right**: Real RPG-style progression that makes fitness fun
2. **Multi-Device Support**: Unique feature for group training and coaching
3. **Seamless Polar Integration**: Best-in-class integration with Polar devices
4. **Cross-Platform**: iOS, Android, and Web support
5. **Real-time Tracking**: Live metrics and instant feedback
6. **Collectible Creatures**: Fun and engaging unlock system
7. **Automatic Sync**: Set it and forget it - workouts sync automatically
8. **Professional-Grade**: Built for both casual users and fitness professionals
9. **Privacy-Focused**: Your data stays secure
10. **Beautiful UI**: Modern, intuitive interface with smooth animations

---

*For architectural details, see [ARCHITECTURE.md](ARCHITECTURE.md)*
*For multi-device setup instructions, see [MULTI_DEVICE_GUIDE.md](MULTI_DEVICE_GUIDE.md)*
