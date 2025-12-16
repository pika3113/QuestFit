/**
 * Inspect activity distance values for a user across a date range.
 *
 * Usage:
 *   node scripts/inspect-instructor-distance.js USER_ID 2025-11-13 2025-12-12
 */

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const requiredEnvVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missing = requiredEnvVars.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('Missing required Firebase env vars:', missing.join(', '));
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

function parseIso(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d) {
  return d.toISOString().split('T')[0];
}

function dateRange(start, end) {
  const out = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur <= e) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

async function main() {
  const userId = process.argv[2];
  const startStr = process.argv[3];
  const endStr = process.argv[4];

  if (!userId || !startStr || !endStr) {
    console.error('Usage: node scripts/inspect-instructor-distance.js USER_ID YYYY-MM-DD YYYY-MM-DD');
    process.exit(1);
  }

  const start = parseIso(startStr);
  const end = parseIso(endStr);
  if (!start || !end) {
    console.error('Invalid date(s). Use YYYY-MM-DD.');
    process.exit(1);
  }

  const dates = dateRange(start, end);
  const polar = db.collection('users').doc(userId).collection('polarData');

  console.log(`\n🔎 Distances for ${userId} from ${startStr} to ${endStr}`);
  console.log('date       | dist_from_steps(m) | activity.distanceMeters | derived_km');
  console.log('-'.repeat(72));

  for (const ds of dates) {
    const snap = await polar.doc('activities').collection('all').doc(ds).get();
    if (!snap.exists) {
      console.log(`${ds} | (missing)`);
      continue;
    }

    const a = snap.data() || {};
    const dSteps = typeof a.distance_from_steps === 'number' ? a.distance_from_steps : null;
    const dAct = typeof a?.activity?.distanceMeters === 'number' ? a.activity.distanceMeters : null;
    const meters = dSteps ?? dAct;
    const km = meters != null ? (meters / 1000).toFixed(2) : '—';

    const pad = (v) => String(v ?? '—').padStart(16, ' ');
    console.log(`${ds} |${pad(dSteps)} |${pad(dAct)} | ${km}`);
  }

  console.log('');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
