/**
 * Sync Polar Data to Firebase
 * 
 * This script:
 * 1. Fetches activities and health data from Polar API for all users
 * 2. Inserts the data directly into Firebase
 * 3. Saves a summary of what was synced
 * 
 * Usage:
 *   node scripts/sync-polar-data-to-firebase.js [date]
 * 
 * Examples:
 *   node scripts/sync-polar-data-to-firebase.js              # Sync today's data
 *   node scripts/sync-polar-data-to-firebase.js 2025-11-20   # Sync specific date
 */

const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local (preferred) or fallback to .env
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required Firebase env vars:', missing.join(', '));
    console.error('Create `.env.local` (or `.env`) with FIREBASE_* values for Admin SDK.');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

/**
 * Get all users who have connected their Polar accounts
 */
async function getUsersWithPolarTokens() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef
      .where('polarAccessToken', '!=', null)
      .get();

    if (snapshot.empty) {
      console.log('No users with Polar tokens found');
      return [];
    }

    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.polarAccessToken) {
        users.push({
          userId: doc.id,
          accessToken: data.polarAccessToken,
          polarUserId: data.polarUserId,
        });
      }
    });

    console.log(`Found ${users.length} user(s) with Polar tokens`);
    return users;
  } catch (error) {
    console.error('Error fetching users with Polar tokens:', error.message);
    return [];
  }
}

/**
 * Fetch data from Polar API for a specific endpoint
 */
async function fetchPolarData(accessToken, endpoint) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  };

  try {
    const response = await axios.get(`${POLAR_BASE_URL}${endpoint}`, { headers });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null; // No data available
    }
    throw error;
  }
}

/**
 * Fetch all data types for a user on a specific date
 */
async function fetchUserDailyData(accessToken, date) {
  const result = {
    date,
    activities: null,
    sleep: null,
    nightlyRecharge: null,
    continuousHeartRate: null,
    cardioLoad: null,
    exercises: [],
    errors: [],
  };

  // Fetch activities
  try {
    console.log('  🔄 Fetching activities...');
    result.activities = await fetchPolarData(accessToken, `/users/activities/${date}`);
    if (result.activities) console.log('    ✓ Activities fetched');
  } catch (error) {
    console.error('    ✗ Activities error:', error.message);
    result.errors.push({ type: 'activities', error: error.message });
  }

  // Fetch sleep
  try {
    console.log('  🔄 Fetching sleep...');
    result.sleep = await fetchPolarData(accessToken, `/users/sleep/${date}`);
    if (result.sleep) console.log('    ✓ Sleep fetched');
  } catch (error) {
    console.error('    ✗ Sleep error:', error.message);
    result.errors.push({ type: 'sleep', error: error.message });
  }

  // Fetch nightly recharge
  try {
    console.log('  🔄 Fetching nightly recharge...');
    result.nightlyRecharge = await fetchPolarData(accessToken, `/users/nightly-recharge/${date}`);
    if (result.nightlyRecharge) console.log('    ✓ Nightly recharge fetched');
  } catch (error) {
    console.error('    ✗ Nightly recharge error:', error.message);
    result.errors.push({ type: 'nightlyRecharge', error: error.message });
  }

  // Fetch continuous heart rate
  try {
    console.log('  🔄 Fetching continuous heart rate...');
    result.continuousHeartRate = await fetchPolarData(accessToken, `/users/continuous-heart-rate/${date}`);
    if (result.continuousHeartRate) console.log('    ✓ Continuous heart rate fetched');
  } catch (error) {
    console.error('    ✗ Continuous heart rate error:', error.message);
    result.errors.push({ type: 'continuousHeartRate', error: error.message });
  }

  // Fetch cardio load
  try {
    console.log('  🔄 Fetching cardio load...');
    const cardioData = await fetchPolarData(accessToken, `/users/cardio-load/period/days/1`);
    if (cardioData && cardioData.length > 0) {
      result.cardioLoad = cardioData[0]; // First item is today's data
      console.log('    ✓ Cardio load fetched');
    }
  } catch (error) {
    console.error('    ✗ Cardio load error:', error.message);
    result.errors.push({ type: 'cardioLoad', error: error.message });
  }

  // Fetch exercises
  try {
    console.log('  🔄 Fetching exercises...');
    const exercisesList = await fetchPolarData(accessToken, `/exercises`);
    
    if (exercisesList && exercisesList.length > 0) {
      console.log(`    ℹ️  Found ${exercisesList.length} total exercises`);
      
      // Filter exercises uploaded on the specified date
      const todayExercises = exercisesList.filter((ex) => {
        const uploadDate = ex.upload_time?.split('T')[0];
        return uploadDate === date;
      });
      
      console.log(`    ℹ️  Found ${todayExercises.length} exercises for ${date}`);
      
      // Fetch detailed data for each exercise
      for (const exercise of todayExercises) {
        try {
          const exerciseDetails = await fetchPolarData(accessToken, `/exercises/${exercise.id}?samples=true`);
          if (exerciseDetails) {
            result.exercises.push(exerciseDetails);
            console.log(`    ✓ Exercise ${exercise.id} fetched`);
          }
        } catch (error) {
          console.error(`    ✗ Error fetching exercise ${exercise.id}:`, error.message);
          result.errors.push({ type: 'exercise', exerciseId: exercise.id, error: error.message });
        }
      }
    }
  } catch (error) {
    console.error('    ✗ Exercises error:', error.message);
    result.errors.push({ type: 'exercises', error: error.message });
  }

  return result;
}

/**
 * Insert fetched data into Firebase
 */
async function insertDataToFirebase(userId, date, data) {
  const batch = db.batch();
  const userPolarRef = db.collection('users').doc(userId).collection('polarData');
  const syncedAt = new Date().toISOString();
  let itemsQueued = 0;

  const normalizeActivityDistance = (activitiesPayload) => {
    const activity = activitiesPayload?.activity ?? activitiesPayload;
    if (!activity || typeof activity !== 'object') return null;

    const rawDistance =
      activity.distance ??
      activity.total_distance ??
      activity.totalDistance ??
      activity.distance_meters ??
      activity.distanceMeters;

    const distanceMeters =
      typeof rawDistance === 'number' && Number.isFinite(rawDistance) ? rawDistance : null;

    return {
      activity: {
        ...activity,
        distanceMeters,
        distanceKm: distanceMeters != null ? distanceMeters / 1000 : null,
      },
    };
  };

  console.log('  💾 Preparing data for Firebase...');

  // Insert activities
  if (data.activities) {
    const ref = userPolarRef.doc('activities').collection('all').doc(date);
    const normalized = normalizeActivityDistance(data.activities);
    if (normalized) {
      batch.set(ref, { ...data.activities, ...normalized, syncedAt });
    } else {
      batch.set(ref, { ...data.activities, syncedAt });
    }
    itemsQueued++;
    console.log('    ✓ Activities queued');
  }

  // Insert sleep
  if (data.sleep) {
    const ref = userPolarRef.doc('sleep').collection('all').doc(date);
    batch.set(ref, { ...data.sleep, syncedAt });
    itemsQueued++;
    console.log('    ✓ Sleep queued');
  }

  // Insert nightly recharge
  if (data.nightlyRecharge) {
    const ref = userPolarRef.doc('nightlyRecharge').collection('all').doc(date);
    batch.set(ref, { ...data.nightlyRecharge, syncedAt });
    itemsQueued++;
    console.log('    ✓ Nightly recharge queued');
  }

  // Insert continuous heart rate
  if (data.continuousHeartRate) {
    const ref = userPolarRef.doc('continuousHeartRate').collection('all').doc(date);
    batch.set(ref, { ...data.continuousHeartRate, syncedAt });
    itemsQueued++;
    console.log('    ✓ Continuous heart rate queued');
  }

  // Insert cardio load
  if (data.cardioLoad) {
    const ref = userPolarRef.doc('cardioLoad').collection('all').doc(date);
    batch.set(ref, { data: data.cardioLoad, syncedAt });
    itemsQueued++;
    console.log('    ✓ Cardio load queued');
  }

  // Insert exercises - group by date for easier filtering
  if (data.exercises && data.exercises.length > 0) {
    // Create an array to store all exercises for this date
    const exercisesForDate = data.exercises.map(exercise => ({
      ...exercise,
      syncedAt
    }));
    
    const ref = userPolarRef.doc('exercises').collection('all').doc(date);
    batch.set(ref, { 
      date,
      exercises: exercisesForDate,
      count: exercisesForDate.length,
      syncedAt 
    });
    itemsQueued++;
    console.log(`    ✓ ${data.exercises.length} exercise(s) queued`);
  }

  // Create summary document
  const summary = {
    userId,
    date,
    syncedAt,
    dataTypes: {
      activities: !!data.activities,
      sleep: !!data.sleep,
      nightlyRecharge: !!data.nightlyRecharge,
      continuousHeartRate: !!data.continuousHeartRate,
      cardioLoad: !!data.cardioLoad,
      exercises: data.exercises.length,
    },
    errors: data.errors,
    itemsStored: itemsQueued,
  };

  const summaryRef = userPolarRef.doc('syncSummary').collection('all').doc(date);
  batch.set(summaryRef, summary);
  console.log('    ✓ Summary queued');

  // Commit the batch
  await batch.commit();
  console.log('  ✅ Data committed to Firebase');

  return summary;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Polar to Firebase sync...\n');
  
  // Get date from command line or use today
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  console.log(`📅 Syncing data for date: ${date}\n`);
  
  // Get all users with Polar tokens
  const users = await getUsersWithPolarTokens();
  
  if (users.length === 0) {
    console.log('❌ No users with Polar tokens found');
    process.exit(1);
  }
  
  const results = {
    total: users.length,
    successful: 0,
    failed: 0,
    errors: [],
    summaries: [],
  };
  
  // Process each user
  for (const user of users) {
    console.log(`\n📊 Processing user: ${user.userId}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Fetch data from Polar API
      const data = await fetchUserDailyData(user.accessToken, date);
      
      // Insert data into Firebase
      const summary = await insertDataToFirebase(user.userId, date, data);
      
      results.successful++;
      results.summaries.push(summary);
      
      console.log(`\n✅ Successfully synced user ${user.userId}`);
      
    } catch (error) {
      console.error(`\n❌ Error syncing user ${user.userId}:`, error.message);
      results.failed++;
      results.errors.push({
        userId: user.userId,
        error: error.message,
        stack: error.stack,
      });
    }
  }
  
  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Sync completed!\n');
  console.log(`📊 Summary:`);
  console.log(`   Total users: ${results.total}`);
  console.log(`   ✅ Successful: ${results.successful}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (results.summaries.length > 0) {
    console.log('\n📈 Data synced per user:');
    results.summaries.forEach(summary => {
      const dataCount = Object.values(summary.dataTypes).filter(v => v === true).length;
      console.log(`   ${summary.userId}: ${dataCount} data types, ${summary.dataTypes.exercises} exercises`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach(err => {
      console.log(`   ${err.userId}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Done!');
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
