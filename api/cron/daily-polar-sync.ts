import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';
const admin = require('firebase-admin');

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

/**
 * Daily cron job to sync Polar API data for all users
 * Schedule is configured in vercel.json.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const getHeader = (name: string) => {
    const value =
      (req.headers?.[name] ??
        req.headers?.[name.toLowerCase()] ??
        req.headers?.[name.toUpperCase()]) as string | string[] | undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const isVercelCron = (() => {
    const v = getHeader('x-vercel-cron');
    return v === '1' || v === 'true' || v === 'yes';
  })();

  const secretFromQuery = (() => {
    const q = (req.query ?? {}) as Record<string, string | string[] | undefined>;
    const raw = q.cron_secret ?? q.secret ?? q.token;
    return Array.isArray(raw) ? raw[0] : raw;
  })();

  const authHeader = getHeader('authorization');
  const expectedBearer = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  // Auth policy:
  // - Allow Vercel Cron requests (they include x-vercel-cron)
  // - Otherwise, if CRON_SECRET is set, require it via Authorization header or querystring
  if (!isVercelCron && process.env.CRON_SECRET) {
    const ok = authHeader === expectedBearer || secretFromQuery === process.env.CRON_SECRET;
    if (!ok) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('🕐 Daily Polar sync started at', new Date().toISOString());

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get all users with Polar tokens
    const users = await getUsersWithPolarTokens();
    
    if (users.length === 0) {
      console.log('No users with Polar tokens found');
      return res.status(200).json({ 
        message: 'No users to sync',
        date: today,
      });
    }

    const results = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: [] as any[],
      summaries: [] as any[],
    };

    // Process each user
    for (const user of users) {
      try {
        console.log(`📊 Syncing data for user ${user.userId}`);
        
        const data = await fetchUserDailyData(user.accessToken, today);
        const summary = await insertDataToFirebase(user.userId, today, data);
        
        results.successful++;
        results.summaries.push(summary);
        
        console.log(`✅ Successfully synced user ${user.userId}`);
      } catch (error: any) {
        console.error(`❌ Error syncing user ${user.userId}:`, error.message);
        results.failed++;
        results.errors.push({
          userId: user.userId,
          error: error.message,
        });
      }
    }

    console.log('🎉 Daily Polar sync completed:', results);
    
    return res.status(200).json({
      message: 'Sync completed',
      date: today,
      results,
    });

  } catch (error: any) {
    console.error('💥 Fatal error in daily sync:', error);
    return res.status(500).json({ 
      error: 'Sync failed',
      message: error.message,
    });
  }
}

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
      return [];
    }

    const users: any[] = [];
    snapshot.forEach((doc: any) => {
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
  } catch (error: any) {
    console.error('Error fetching users with Polar tokens:', error.message);
    return [];
  }
}

/**
 * Fetch data from Polar API for a specific endpoint
 */
async function fetchPolarData(accessToken: string, endpoint: string) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  };

  try {
    const response = await axios.get(`${POLAR_BASE_URL}${endpoint}`, { headers });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch all data types for a user on a specific date
 */
async function fetchUserDailyData(accessToken: string, date: string) {
  const result: any = {
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
    result.activities = await fetchPolarData(accessToken, `/users/activities/${date}`);
  } catch (error: any) {
    result.errors.push({ type: 'activities', error: error.message });
  }

  // Fetch sleep
  try {
    result.sleep = await fetchPolarData(accessToken, `/users/sleep/${date}`);
  } catch (error: any) {
    result.errors.push({ type: 'sleep', error: error.message });
  }

  // Fetch nightly recharge
  try {
    result.nightlyRecharge = await fetchPolarData(accessToken, `/users/nightly-recharge/${date}`);
  } catch (error: any) {
    result.errors.push({ type: 'nightlyRecharge', error: error.message });
  }

  // Fetch continuous heart rate
  try {
    result.continuousHeartRate = await fetchPolarData(accessToken, `/users/continuous-heart-rate/${date}`);
  } catch (error: any) {
    result.errors.push({ type: 'continuousHeartRate', error: error.message });
  }

  // Fetch cardio load
  try {
    const cardioData = await fetchPolarData(accessToken, `/users/cardio-load/period/days/1`);
    if (cardioData && cardioData.length > 0) {
      result.cardioLoad = cardioData[0];
    }
  } catch (error: any) {
    result.errors.push({ type: 'cardioLoad', error: error.message });
  }

  // Fetch exercises
  try {
    const exercisesList = await fetchPolarData(accessToken, `/exercises`);
    
    if (exercisesList && exercisesList.length > 0) {
      const todayExercises = exercisesList.filter((ex: any) => {
        const uploadDate = ex.upload_time?.split('T')[0];
        return uploadDate === date;
      });
      
      for (const exercise of todayExercises) {
        try {
          const exerciseDetails = await fetchPolarData(accessToken, `/exercises/${exercise.id}?samples=true`);
          if (exerciseDetails) {
            result.exercises.push(exerciseDetails);
          }
        } catch (error: any) {
          result.errors.push({ type: 'exercise', exerciseId: exercise.id, error: error.message });
        }
      }
    }
  } catch (error: any) {
    result.errors.push({ type: 'exercises', error: error.message });
  }

  return result;
}

/**
 * Insert fetched data into Firebase
 */
async function insertDataToFirebase(userId: string, date: string, data: any) {
  const batch = db.batch();
  const userPolarRef = db.collection('users').doc(userId).collection('polarData');
  const syncedAt = new Date().toISOString();
  let itemsQueued = 0;

  const userRef = db.collection('users').doc(userId);
  // Track when we checked Polar, regardless of whether any new docs were written.
  batch.set(userRef, { lastChecked: syncedAt }, { merge: true });

  const normalizeActivityDistance = (activitiesPayload: any) => {
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
  }

  // Insert sleep
  if (data.sleep) {
    const ref = userPolarRef.doc('sleep').collection('all').doc(date);
    batch.set(ref, { ...data.sleep, syncedAt });
    itemsQueued++;
  }

  // Insert nightly recharge
  if (data.nightlyRecharge) {
    const ref = userPolarRef.doc('nightlyRecharge').collection('all').doc(date);
    batch.set(ref, { ...data.nightlyRecharge, syncedAt });
    itemsQueued++;
  }

  // Insert continuous heart rate
  if (data.continuousHeartRate) {
    const ref = userPolarRef.doc('continuousHeartRate').collection('all').doc(date);
    batch.set(ref, { ...data.continuousHeartRate, syncedAt });
    itemsQueued++;
  }

  // Insert cardio load
  if (data.cardioLoad) {
    const ref = userPolarRef.doc('cardioLoad').collection('all').doc(date);
    batch.set(ref, { data: data.cardioLoad, syncedAt });
    itemsQueued++;
  }

  // Insert exercises
  if (data.exercises && data.exercises.length > 0) {
    const exercisesForDate = data.exercises.map((exercise: any) => ({
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

    // Check for device_id and update user document
    // We use the last exercise in the list as it's likely the most recent one processed
    const exerciseWithDevice = exercisesForDate.find((ex: any) => ex.device_id);
    if (exerciseWithDevice) {
      batch.set(userRef, { deviceId: exerciseWithDevice.device_id }, { merge: true });
    }
  }

  // Only bump lastSync if we actually stored any daily data documents.
  if (itemsQueued > 0) {
    batch.set(userRef, { lastSync: syncedAt }, { merge: true });
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

  // Commit the batch
  await batch.commit();

  return summary;
}
