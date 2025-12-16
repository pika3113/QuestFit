const axios = require('axios');
const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (prefer .env.local overrides if present)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase service account env vars. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in .env/.env.local.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      // Support both naming styles expected by different firebase-admin versions
      projectId,
      clientEmail,
      privateKey,
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }),
  });
}

const db = admin.firestore();

async function getPolarCredentials(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  const data = userDoc.data();
  if (!data.polarAccessToken || !data.polarUserId) {
    throw new Error(`User ${userId} does not have Polar credentials linked`);
  }
  return {
    accessToken: data.polarAccessToken,
    polarUserId: data.polarUserId
  };
}

async function getAllUsersWithPolarCredentials() {
  const snapshot = await db.collection('users').where('polarAccessToken', '!=', null).get();
  if (snapshot.empty) return [];

  const users = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (data.polarAccessToken && data.polarUserId) {
      users.push({
        userId: doc.id,
        accessToken: data.polarAccessToken,
        polarUserId: data.polarUserId,
      });
    }
  });

  return users;
}

async function fetchPhysicalInfo(userId, providedCredentials) {
  try {
    const checkedAt = new Date().toISOString();
    console.log(`Fetching physical info for user: ${userId}`);
    const creds = providedCredentials || (await getPolarCredentials(userId));
    const { accessToken, polarUserId } = creds;

    // Always record that we checked for updates, even if there is no new data.
    await db.collection('users').doc(userId).set(
      {
        lastChecked: checkedAt,
      },
      { merge: true }
    );

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Step 1: Create Transaction
    console.log('Step 1: Creating transaction...');
    let transactionId;
    let resourceUri;
    
    try {
      const createTransactionResponse = await axios.post(
        `${POLAR_BASE_URL}/users/${polarUserId}/physical-information-transactions`,
        {},
        { headers }
      );
      transactionId = createTransactionResponse.data['transaction-id'];
      resourceUri = createTransactionResponse.data['resource-uri'];
      console.log(`Transaction created. ID: ${transactionId}`);
    } catch (error) {
      if (error.response && error.response.status === 204) {
        console.log('No new physical information available.');
        return;
      }
      throw error;
    }

    // Step 2: List Physical Infos
    console.log('Step 2: Listing physical info resources...');
    const listResponse = await axios.get(resourceUri, { headers });
    const physicalInfos = listResponse.data['physical-informations'];
    console.log(`Found ${physicalInfos.length} physical info entries.`);

    // Step 3: Get Physical Info Data
    console.log('Step 3: Fetching and saving physical info data...');
    let savedCount = 0;
    for (const infoUrl of physicalInfos) {
      const infoResponse = await axios.get(infoUrl, { headers });
      const infoData = infoResponse.data;
      
      console.log('Physical Info Data:', JSON.stringify(infoData, null, 2));

      const fetchedAt = new Date().toISOString();

      // Save to Firebase (deterministic doc id so re-runs won't duplicate)
      const docId = crypto.createHash('sha256').update(String(infoUrl)).digest('hex');
      await db
        .doc(`users/${userId}/polarData/physicalInfo/all/${docId}`)
        .set(
          {
            ...infoData,
            fetchedAt,
            transactionId,
            sourceUrl: infoUrl,
          },
          { merge: true }
        );

      savedCount++;
      console.log('Saved to Firebase.');
    }

    if (savedCount > 0) {
      const syncedAt = new Date().toISOString();
      const today = syncedAt.split('T')[0];

      // Update user-level lastSync (this is what the app surfaces)
      await db.collection('users').doc(userId).set(
        {
          lastSync: syncedAt,
        },
        { merge: true }
      );

      // Also write a sync summary entry (helps dashboard fallback logic)
      await db
        .doc(`users/${userId}/polarData/syncSummary/all/${today}`)
        .set(
          {
            date: today,
            syncedAt,
            physicalInfo: true,
            physicalInfoCount: savedCount,
          },
          { merge: true }
        );
    }

    // Step 4: Commit Transaction
    console.log('Step 4: Committing transaction...');
    await axios.put(
      `${POLAR_BASE_URL}/users/${polarUserId}/physical-information-transactions/${transactionId}`,
      {},
      { headers }
    );
    console.log('Transaction committed successfully.');

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  } finally {
    // Close firebase connection if needed, but usually script ends
    // process.exit(); 
  }
}

// Optional userId argument: if omitted, sync all users with Polar credentials.
const userId = process.argv[2];

(async () => {
  if (userId) {
    await fetchPhysicalInfo(userId);
    console.log('Done.');
    return;
  }

  const users = await getAllUsersWithPolarCredentials();
  if (users.length === 0) {
    console.log('No users with Polar credentials found.');
    return;
  }

  console.log(`Found ${users.length} user(s) with Polar credentials. Starting physical info sync...`);

  const results = {
    total: users.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  for (const u of users) {
    try {
      await fetchPhysicalInfo(u.userId, { accessToken: u.accessToken, polarUserId: u.polarUserId });
      results.successful++;
    } catch (e) {
      results.failed++;
      results.errors.push({ userId: u.userId, error: e && e.message ? e.message : String(e) });
      console.error(`Error syncing physical info for ${u.userId}:`, e && e.message ? e.message : e);
    }
  }

  console.log('Physical info sync finished:', results);
})();
