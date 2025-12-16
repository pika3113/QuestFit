import OpenAI from 'openai';
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from '../vercel-types';

dotenv.config();

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// Helper to parse Firestore REST API response
function parseFirestoreValue(value: any): any {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.mapValue !== undefined) return parseFirestoreMap(value.mapValue.fields || {});
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(parseFirestoreValue);
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  return value;
}

function parseFirestoreMap(fields: any): any {
  const result: any = {};
  for (const key in fields) {
    result[key] = parseFirestoreValue(fields[key]);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Helper to convert JS object to Firestore JSON for writing
function toFirestoreValue(value: any): any {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: value };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: any = {};
    for (const key in value) {
      fields[key] = toFirestoreValue(value[key]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isRecord(req.body)) {
      return res.status(400).json({ error: 'Invalid body' });
    }

    const userId = typeof req.body.userId === 'string' ? req.body.userId : undefined;
    const date = typeof req.body.date === 'string' ? req.body.date : undefined;
    const forceRefreshRaw = req.body.forceRefresh;
    const forceRefresh =
      forceRefreshRaw === true || forceRefreshRaw === 'true' || forceRefreshRaw === 1 || forceRefreshRaw === '1';

    if (!userId || !date) {
      return res.status(400).json({ error: 'Missing userId or date' });
    }

    // Get Access Token
    const tokenObj = await admin.app().options.credential.getAccessToken();
    const accessToken = tokenObj.access_token;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const summaryPath = `projects/${projectId}/databases/(default)/documents/users/${userId}/openAIGen/${date}`;

    // 1. Check if summary already exists (REST API)
    // Only check cache if forceRefresh is false
    if (!forceRefresh) {
      const checkResponse = await fetch(`https://firestore.googleapis.com/v1/${summaryPath}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (checkResponse.ok) {
        console.log('[API] Returning cached summary from Firestore');
        const doc = await checkResponse.json();
        return res.status(200).json(parseFirestoreMap(doc.fields));
      }
    }

    // 2. Fetch all health data for the date (BatchGet)
    console.log(`[API] Fetching data for user: ${userId}, date: ${date}`);
    
    const docPaths = [
      `projects/${projectId}/databases/(default)/documents/users/${userId}/polarData/activities/all/${date}`,
      `projects/${projectId}/databases/(default)/documents/users/${userId}/polarData/cardioLoad/all/${date}`,
      `projects/${projectId}/databases/(default)/documents/users/${userId}/polarData/sleep/all/${date}`,
      `projects/${projectId}/databases/(default)/documents/users/${userId}/polarData/nightlyRecharge/all/${date}`,
      `projects/${projectId}/databases/(default)/documents/users/${userId}/polarData/exercises/all/${date}`,
    ];

    const batchResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchGet`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ documents: docPaths })
    });

    if (!batchResponse.ok) {
      const errText = await batchResponse.text();
      console.error('[API] Batch get failed:', errText);
      throw new Error(`Firestore batch get failed: ${batchResponse.statusText}`);
    }

    const batchResults = await batchResponse.json(); // Array of results
    
    // Map results to keys
    const dataMap: any = {
      activity: null,
      cardioLoad: null,
      sleep: null,
      nightlyRecharge: null,
      exercises: null,
    };

    const pathToKey: any = {
      [docPaths[0]]: 'activity',
      [docPaths[1]]: 'cardioLoad',
      [docPaths[2]]: 'sleep',
      [docPaths[3]]: 'nightlyRecharge',
      [docPaths[4]]: 'exercises',
    };

    if (Array.isArray(batchResults)) {
      for (const result of batchResults) {
        if (result.found) {
          const path = result.found.name;
          const key = pathToKey[path];
          if (key) {
            dataMap[key] = parseFirestoreMap(result.found.fields);
          }
        }
      }
    }

    // Remove nulls
    const cleanData = Object.fromEntries(
      Object.entries(dataMap).filter(([_, v]) => v != null)
    );

    // Sanitize data to reduce token count
    if (cleanData.sleep) {
      // Remove high-frequency samples
      delete (cleanData.sleep as any).heart_rate_samples;
      delete (cleanData.sleep as any).hypnogram;
    }

    if (cleanData.exercises) {
      if (Array.isArray(cleanData.exercises)) {
        cleanData.exercises.forEach((ex: any) => {
          delete ex.samples;
          delete ex.heart_rate_zones;
          delete ex.speed_zones;
        });
      } else if ((cleanData.exercises as any).exercises && Array.isArray((cleanData.exercises as any).exercises)) {
         (cleanData.exercises as any).exercises.forEach((ex: any) => {
          delete ex.samples;
          delete ex.heart_rate_zones;
          delete ex.speed_zones;
        });
      }
    }

    if (Object.keys(cleanData).length === 0) {
      return res.status(404).json({ error: 'No health data found for this date' });
    }

    const jsonString = JSON.stringify(cleanData);

    // 4. Call OpenAI
    console.log('[API] Sending request to OpenAI...');
    
    // @ts-ignore - Using experimental/beta API
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Analyse this user's health data carefully. Assume the 2nd person perspective of the cadet who is viewing his own statistics. This user is a military cadet who is in officer cadet school, and is training to be a digital and intelligence officer. Sitting in front of a computer and listening to lectures are the norm for this user. Keep in mind that the cadet does not have much decision over his own schedule. There are 2-3 physical conducts per week. Try not to mention the cause, but more of the impact. You always gives concise, deterministic summaries.`
            },
            {
              type: "input_text",
              text: jsonString
            }
          ]
        }
      ],
      instructions: "Return a JSON object with fields: insights, recommendations, [short]insights, [short]recommendations, which is a single paragraph each, where the 2 labelled [short] are the short version of their long counterparts and they are limited to 30 words each. Order the paragraph by daily activity, exercise and cardio then sleep. Do not return the original data. Do not have any mention of the numerical data statistics that was given. Do not use ';' as much as possible unless necessary.",
      store: true,
      reasoning: {
        effort: 'low'
      },
    });

    // @ts-ignore
    const content = response.output_text;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse OpenAI response", content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // 5. Save to Firestore (REST API)
    const resultWithTimestamp = {
      ...result,
      createdAt: new Date().toISOString()
    };

    const writeResponse = await fetch(`https://firestore.googleapis.com/v1/${summaryPath}`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: toFirestoreValue(resultWithTimestamp).mapValue.fields
      })
    });

    if (!writeResponse.ok) {
      console.error('[API] Write failed:', await writeResponse.text());
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error generating summary:', error);
    return res.status(500).json({ error: error.message });
  }
}
