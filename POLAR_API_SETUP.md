# Polar API Integration Guide

## Overview
The QuestFit app now includes a dedicated **Polar API** tab (3rd tab in the navigation) for testing and managing Polar AccessLink API connections.

## Getting Started

### 1. Obtain Your Access Token
1. Go to [Polar AccessLink API](https://www.polar.com/accesslink-api/)
2. Register your application
3. Follow Polar's OAuth2 authentication flow to obtain an access token
4. Copy your access token

### 2. Configure in the App

1. Open the **Polar API** tab in the app
2. Paste your access token in the **Access Token** field
3. Tap **Save Token** - this stores it securely in AsyncStorage

### 3. Test API Endpoints

The tab provides easy-to-use test buttons for these Polar API endpoints:

#### Available Tests:

- **Get User Profile** - Retrieves basic user information
  - Endpoint: `GET /users`
  - Returns: User ID, email, name, etc.

- **Get Workouts/Exercises** - Lists all recorded workouts
  - Endpoint: `GET /exercises`
  - Returns: Array of workout data with timestamps, calories, distance

- **Get Activity Zones** - Retrieves user's activity intensity zones
  - Endpoint: `GET /users/activity-zones`
  - Returns: Zone definitions and intensity levels

- **Get Physical Info** - Gets user's physical measurements
  - Endpoint: `GET /users/physical-info`
  - Returns: Weight, height, and other physical parameters

- **Get Heart Rate Zones** - Retrieves personalized HR zones
  - Endpoint: `GET /users/heart-rate-zones`
  - Returns: HR zone thresholds (zone 1-5)

## API Response Display

- All API responses are displayed in JSON format in the **API Response** section
- Recent workouts are displayed in a formatted list showing:
  - Sport type and date
  - Duration (minutes)
  - Calories burned
  - Distance (km)

## Token Management

- **Save Token**: Stores your token securely for future app sessions
- **Clear Token**: Removes the stored token from the device

## Error Handling

If you encounter errors:
- **"Access token not set"** - Make sure to save your token first
- **Unauthorized (401)** - Your token may have expired, get a new one from Polar
- **Not Found (404)** - The endpoint or data may not be available for your account
- **Rate Limited (429)** - You've exceeded the API rate limit, wait and try again

## API Documentation

For complete API documentation and endpoint reference, visit:
https://www.polar.com/accesslink-api/

### Key Endpoints:
- `GET /users` - User profile
- `GET /exercises` - Workouts list
- `GET /exercises/{id}` - Specific workout
- `GET /exercises/{id}/heart-rate` - HR data for workout
- `GET /exercises/{id}/summary` - Workout summary
- `GET /users/physical-info` - Physical measurements
- `GET /users/heart-rate-zones` - HR zones
- `GET /users/activity-zones` - Activity zones

## Service Code

The Polar API service is located at `src/services/polarApi.ts` and can be used in other parts of the app:

```typescript
import polarApi from '@/src/services/polarApi';

// Set token
polarApi.setAccessToken(token);

// Get user profile
const profile = await polarApi.getUserProfile();

// Get workouts
const workouts = await polarApi.getWorkouts();

// Get heart rate data for a workout
const hrData = await polarApi.getHeartRateData(exerciseId);
```

## Next Steps

After testing the API connections, you can:
1. Integrate real workout data into the home screen
2. Display Polar fitness data in the UI
3. Use heart rate zones for game difficulty scaling
4. Sync workout data with Firebase for persistent storage
5. Create achievement rewards based on Polar metrics

## Troubleshooting

### Token Not Saving
- Check that AsyncStorage is properly installed
- Ensure sufficient device storage

### API Requests Failing
- Verify internet connection
- Check that token is still valid (Polar tokens may expire)
- Review Polar API rate limits

### CORS Issues (Web)
- Some API calls may fail on web due to CORS policies
- This is expected; the app is designed for mobile use

## Support

For issues with the Polar API itself, refer to:
- [Polar Developer Support](https://www.polar.com/en/products/sport-watches-training-devices)
- Official API documentation at polar.com/accesslink-api
