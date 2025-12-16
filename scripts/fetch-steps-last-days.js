/**
 * Fetch last N days of steps for a user.
 *
 * Usage:
 *   node scripts/fetch-steps-last-days.js <userId> [days]
 *
 * Reads Firebase Admin creds from .env.local:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (admin.apps.length === 0) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Missing Firebase env vars in .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
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

function formatDateLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const userId = (process.argv[2] ?? '').trim();
  const daysArg = process.argv[3];
  const days = Number.isFinite(Number(daysArg)) ? Math.max(1, Math.min(60, Math.floor(Number(daysArg)))) : 10;

  if (!userId) {
    console.error('Usage: node scripts/fetch-steps-last-days.js <userId> [days]');
    process.exit(1);
  }

  const today = new Date();
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(formatDateLocal(d));
  }

  console.log(`\nSteps for user ${userId} (last ${days} days)`);
  console.log('date       | steps');
  console.log('-----------|------');

  let total = 0;
  let count = 0;
  let missing = 0;

  const results = await Promise.all(
    dates.map(async (date) => {
      const docRef = db
        .collection('users')
        .doc(userId)
        .collection('polarData')
        .doc('activities')
        .collection('all')
        .doc(date);

      const snap = await docRef.get();
      if (!snap.exists) return { date, steps: null };

      const data = snap.data() || {};
      const steps =
        typeof data.steps === 'number'
          ? data.steps
          : typeof data.steps === 'string'
            ? Number(data.steps)
            : NaN;

      return { date, steps: Number.isFinite(steps) ? steps : null };
    })
  );

  for (const r of results) {
    if (r.steps == null) {
      console.log(`${r.date} | --`);
      missing++;
      continue;
    }
    console.log(`${r.date} | ${r.steps}`);
    total += r.steps;
    count++;
  }

  console.log('\nSummary');
  console.log(`- Days with steps: ${count}/${days}`);
  console.log(`- Missing/invalid: ${missing}/${days}`);
  if (count > 0) {
    console.log(`- Total steps: ${total}`);
    console.log(`- Avg/day (available): ${Math.round(total / count)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
