import type { VercelRequest, VercelResponse } from '../vercel-types';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Polar signs the raw request body. Vercel's default JSON body parsing can
// change formatting and break signature verification, so we disable it.
export const config = {
  api: {
    bodyParser: false,
  },
};

let admin: any;
let db: any;

function getDb() {
  if (db) return db;
  if (!admin) admin = require('firebase-admin');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  db = admin.firestore();
  return db;
}

// Signature secret from Polar webhook creation (store in env)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

async function readRawBody(req: any): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getHeader(req: VercelRequest, name: string): string | undefined {
  const value =
    (req.headers?.[name] ??
      req.headers?.[name.toLowerCase()] ??
      req.headers?.[name.toUpperCase()]) as string | string[] | undefined;
  return Array.isArray(value) ? value[0] : value;
}

function isPing(body: Record<string, unknown>, req: VercelRequest) {
  const event = getString(body, 'event');
  const headerEvent = getHeader(req, 'polar-webhook-event');
  return (event && event.toUpperCase() === 'PING') || (headerEvent && headerEvent.toUpperCase() === 'PING');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Webhook received:', req.method);

  // Handle GET requests (Health check)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'active',
      message: 'Polar Webhook Endpoint is running' 
    });
  }

  if (req.method === 'POST') {
    let parsedBody: unknown;
    const rawBodyBuf = await readRawBody(req as any);
    const rawBody = rawBodyBuf.toString('utf8');
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      console.log('Webhook body is not valid JSON; ignoring');
      return res.status(200).json({ message: 'Invalid payload, ignoring' });
    }

    const bodyRecord = isRecord(parsedBody) ? (parsedBody as Record<string, unknown>) : undefined;
    if (!bodyRecord) {
      console.log('Webhook body is not an object; ignoring');
      return res.status(200).json({ message: 'Invalid payload, ignoring' });
    }

    // Handle ping from Polar during webhook creation/validation.
    // Polar can send event=PING and/or Polar-Webhook-Event: PING.
    if (isPing(bodyRecord, req)) {
      console.log('Ping received from Polar');
      return res.status(200).json({ message: 'Pong' });
    }

    const signature = getHeader(req, 'polar-webhook-signature');
    const signatureSecret = process.env.POLAR_WEBHOOK_SIGNATURE_SECRET;

    // Verify signature (fail closed) for real webhook deliveries
    if (!signatureSecret) {
      console.error('Missing POLAR_WEBHOOK_SIGNATURE_SECRET env var');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    if (!signature) {
      console.error('Missing polar-webhook-signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', signatureSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const ok = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!ok) {
      console.error('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('Signature verified');

    console.log('Webhook event received:', JSON.stringify(bodyRecord, null, 2));

    const event = getString(bodyRecord, 'event');
    const url = getString(bodyRecord, 'url');
    const webhookDate = getString(bodyRecord, 'date');
    const polarUserIdRaw = bodyRecord['user_id'];
    const polarUserId =
      typeof polarUserIdRaw === 'string'
        ? polarUserIdRaw
        : typeof polarUserIdRaw === 'number'
          ? String(polarUserIdRaw)
          : undefined;

    if (!url || !polarUserId) {
        console.log('Missing url or user_id in webhook payload');
        return res.status(200).json({ message: 'Missing data, ignoring' });
    }

    try {
      const db = getDb();
        // 1. Find the user
        // The document ID is the Polar User ID
        console.log(`Looking up user for Polar ID: ${polarUserId}`);
        const userDoc = await db.collection('users').doc(String(polarUserId)).get();
    
        if (!userDoc.exists) {
          console.log(`User not found for Polar ID: ${polarUserId}`);
          return res.status(200).json({ message: 'User not found, ignoring' });
        }
    
        const userId = userDoc.id;
        console.log(`Found Firebase User ID: ${userId}`);

        // Record that we received/processed a valid webhook delivery for this user.
        const checkedAt = new Date().toISOString();
        await db.collection('users').doc(userId).set({ lastChecked: checkedAt }, { merge: true });

        const userData = userDoc.data();
        const accessToken = userData.polarAccessToken;
    
        if (!accessToken) {
           console.log(`No access token for user ${userId}`);
           return res.status(200).json({ message: 'No access token, ignoring' });
        }

        // 2. Fetch the data
        console.log(`Fetching data from ${url}`);
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            }
        });
        const data = response.data;
        console.log('Fetched data:', JSON.stringify(data, null, 2));
        
        if (!data) {
            console.log('No data received from Polar API');
            return res.status(200).json({ message: 'No data received' });
        }

        // 3. Process based on event type
        const syncedAt = new Date().toISOString();
        const userPolarRef = db.collection('users').doc(userId).collection('polarData');
        
        // Update the user's global lastSync timestamp
        await db.collection('users').doc(userId).update({ lastSync: syncedAt });
        
        console.log(`Writing to Firestore path: users/${userId}/polarData/...`);

        if (event === 'EXERCISE') {
             const startTime = data.start_time; 
             if (startTime) {
                 const date = startTime.split('T')[0];
                 console.log(`Processing EXERCISE for date: ${date}`);
                 
                 // Update deviceID if present in the exercise data
                 if (data.device_id) {
                     console.log(`Updating deviceID for user ${userId} to ${data.device_id}`);
                     await db.collection('users').doc(userId).set({
                         deviceID: data.device_id
                     }, { merge: true });
                 }

                 const ref = userPolarRef.doc('exercises').collection('all').doc(date);
                 console.log(`Target Document: ${ref.path}`);
                 
                 await db.runTransaction(async (t: any) => {
                     const doc = await t.get(ref);
                     let exercises = [];
                     if (doc.exists) {
                         exercises = doc.data().exercises || [];
                     }
                     
                     // Remove existing if updating (by id)
                     const existingIndex = exercises.findIndex((e: any) => e.id === data.id);
                     if (existingIndex > -1) {
                         exercises[existingIndex] = { ...data, syncedAt };
                     } else {
                         exercises.push({ ...data, syncedAt });
                     }
                     
                     t.set(ref, {
                         date,
                         exercises,
                         count: exercises.length,
                         syncedAt
                     }, { merge: true });
                 });

                 // Update sync summary
                 const summaryRef = userPolarRef.doc('syncSummary').collection('all').doc(date);
                 console.log(`Updating Sync Summary at: ${summaryRef.path}`);
                 await summaryRef.set({ syncedAt, date }, { merge: true });

             } else {
                 console.error('Missing start_time in EXERCISE data');
                 return res.status(400).json({ error: 'Missing start_time in EXERCISE data' });
             }
        } else if (event === 'SLEEP') {
             const date = data.date || webhookDate;
             if (date) {
                 console.log(`Processing SLEEP for date: ${date}`);
                 const ref = userPolarRef.doc('sleep').collection('all').doc(date);
                 console.log(`Target Document: ${ref.path}`);
                 await ref.set({ ...data, date, syncedAt });

                 // Update sync summary
                 const summaryRef = userPolarRef.doc('syncSummary').collection('all').doc(date);
                 console.log(`Updating Sync Summary at: ${summaryRef.path}`);
                 await summaryRef.set({ syncedAt, date }, { merge: true });
             } else {
                 console.error('Missing date in SLEEP data');
                 return res.status(400).json({ error: 'Missing date in SLEEP data' });
             }
        } else if (event === 'ACTIVITY_SUMMARY') {
             const date = data.date || webhookDate;
             if (date) {
                 console.log(`Processing ACTIVITY_SUMMARY for date: ${date}`);
                 const ref = userPolarRef.doc('activities').collection('all').doc(date);
                 console.log(`Target Document: ${ref.path}`);
                 await ref.set({ ...data, date, syncedAt });

                 // Update sync summary
                 const summaryRef = userPolarRef.doc('syncSummary').collection('all').doc(date);
                 console.log(`Updating Sync Summary at: ${summaryRef.path}`);
                 await summaryRef.set({ syncedAt, date }, { merge: true });
             } else {
                 console.error('Missing date in ACTIVITY_SUMMARY data');
                 return res.status(400).json({ error: 'Missing date in ACTIVITY_SUMMARY data' });
             }
        } else if (event === 'CONTINUOUS_HEART_RATE') {
             const date = data.date || webhookDate;
             if (date) {
                 console.log(`Processing CONTINUOUS_HEART_RATE for date: ${date}`);
                 const ref = userPolarRef.doc('continuousHeartRate').collection('all').doc(date);
                 console.log(`Target Document: ${ref.path}`);
                 await ref.set({ ...data, date, syncedAt });

                 // Update sync summary
                 const summaryRef = userPolarRef.doc('syncSummary').collection('all').doc(date);
                 console.log(`Updating Sync Summary at: ${summaryRef.path}`);
                 await summaryRef.set({ syncedAt, date }, { merge: true });
             } else {
                 console.error('Missing date in CONTINUOUS_HEART_RATE data');
                 return res.status(400).json({ error: 'Missing date in CONTINUOUS_HEART_RATE data' });
             }
        }
        
        console.log(`Successfully processed ${event} for user ${userId}`);
        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Error processing webhook:', error.message);
        return res.status(200).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
