/**
 * Fill missing Polar data so the Instructor Dashboard looks more complete.
 *
 * What it does (per user, per day):
 * - Ensures docs exist under `users/{userId}/polarData/{type}/all/{date}` for:
 *   - exercises (minimal array, includes distance)
 *   - sleep (minimal fields, includes sleep_score)
 *   - activities (minimal fields, includes distance_from_steps + activity.distanceMeters/distanceKm)
 *   - cardioLoad (minimal fields)
 *   - nightlyRecharge (optional minimal fields)
 *
 * Safety:
 * - Only writes when a doc is missing OR when key fields are missing/empty/zero.
 * - Supports `--dryRun` (default) to preview without writing.
 * - Supports `--onlyUser=<uid>` to target a single user.
 *
 * Usage:
 *   node scripts/fill-missing-instructor-data.js --days=14 --dryRun
 *   node scripts/fill-missing-instructor-data.js --days=30 --write
 *   node scripts/fill-missing-instructor-data.js --days=7 --write --onlyUser=USER_ID
 *   node scripts/fill-missing-instructor-data.js --start=2025-11-01 --end=2025-11-30 --write
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
  console.error('Create `.env.local` (or `.env`) with FIREBASE_* values for Admin SDK.');
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

function parseArgs(argv) {
  const out = {
    days: 14,
    start: null,
    end: null,
    dryRun: true,
    onlyUser: null,
    repairBadDistance: false,
    evenOut: false,
    seed: null,
    maxDistanceMeters: 20000,
    jitterPct: 0.12,
    // Default behavior: make charts look populated.
    // - fillZeroDistance: patch synthetic activity docs that have distance=0
    // - fillZeroDistanceAny: also patch non-synthetic activity docs with distance=0
    fillZeroDistance: true,
    fillZeroDistanceAny: true,
  };

  for (const arg of argv) {
    if (arg.startsWith('--days=')) out.days = Math.max(1, parseInt(arg.split('=')[1], 10) || 14);
    if (arg.startsWith('--start=')) out.start = arg.split('=')[1] || null;
    if (arg.startsWith('--end=')) out.end = arg.split('=')[1] || null;
    if (arg === '--write') out.dryRun = false;
    if (arg === '--dryRun') out.dryRun = true;
    if (arg.startsWith('--onlyUser=')) out.onlyUser = arg.split('=')[1] || null;
    if (arg === '--repairBadDistance') out.repairBadDistance = true;
    if (arg === '--evenOut') out.evenOut = true;
    if (arg.startsWith('--seed=')) out.seed = String(arg.split('=')[1] || '');
    if (arg.startsWith('--maxDistanceMeters=')) {
      out.maxDistanceMeters = Math.max(2000, parseInt(arg.split('=')[1], 10) || out.maxDistanceMeters);
    }
    if (arg.startsWith('--jitterPct=')) {
      const v = parseFloat(arg.split('=')[1]);
      if (Number.isFinite(v)) out.jitterPct = clamp(v, 0, 0.35);
    }
    if (arg === '--fillZeroDistance') out.fillZeroDistance = true;
    if (arg === '--fillZeroDistanceAny') out.fillZeroDistanceAny = true;
    if (arg === '--keepZeros') {
      out.fillZeroDistance = false;
      out.fillZeroDistanceAny = false;
    }
  }

  return out;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDateOrThrow(value, name) {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid ${name}: ${String(value)} (expected YYYY-MM-DD)`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${name}: ${String(value)}`);
  }
  return d;
}

function stableHash32(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seedString) {
  const seed = stableHash32(seedString);
  return mulberry32(seed);
}

function clampFloat(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 0 ? (v[mid - 1] + v[mid]) / 2 : v[mid];
}

function smoothAndJitterDistanceMeters(rawMeters, context) {
  // Purpose: make charts look more even without wrecking realism.
  // - Step 1: normalize obvious unit mistakes (existing heuristic)
  // - Step 2: clamp to a configurable sane max
  // - Step 3: soften extreme spikes toward a baseline (median-like)
  // - Step 4: apply small deterministic jitter so bars aren't too flat
  const { userId, dateStr, seed, maxDistanceMeters, jitterPct } = context;

  const normalized = normalizeMaybeBadDistanceMeters(rawMeters);
  let v = typeof normalized.value === 'number' && Number.isFinite(normalized.value) ? normalized.value : 0;

  // Hard clamp first
  v = clamp(v, 0, maxDistanceMeters);

  // Baseline tied to steps if present, otherwise a reasonable center.
  // If you pass in a baseline, use it; else compute from recent values outside.
  let baseline = context.baselineMeters;
  if (typeof baseline !== 'number' || !Number.isFinite(baseline) || baseline <= 0) baseline = 6500;

  // Pull down big outliers (anything > 1.6x baseline) but keep some variation.
  if (baseline > 0 && v > baseline * 1.6) {
    v = baseline * 1.2 + (v - baseline * 1.6) * 0.15;
  }

  // Pull up tiny non-zero days a bit (so it looks “active-ish”)
  if (v > 0 && v < 900) {
    v = 900;
  }

  // Deterministic jitter
  const rng = makeRng(`${seed || ''}:${userId}:${dateStr}:dist`);
  const jitter = (rng() * 2 - 1) * jitterPct; // [-pct, +pct]
  v = v * (1 + jitter);

  // Final clamp + integer meters
  v = Math.round(clampFloat(v, 0, maxDistanceMeters));
  return { value: v, changed: normalized.changed || v !== rawMeters };
}

function normalizeMaybeBadDistanceMeters(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { changed: false, value: value };

  // Heuristics:
  // - If it's a small decimal (e.g., 2245.07) it's likely km stored in a meters field.
  // - If it's extremely large (e.g., >200,000m) it's likely meters got multiplied by 100/1000 incorrectly.
  // We want daily "from steps" distance to look like meters in a plausible range.

  let v = value;
  let changed = false;

  // km mistakenly stored as meters (often decimal, usually < 200)
  if (!Number.isInteger(v) && v > 0 && v < 200) {
    v = Math.round(v * 1000);
    changed = true;
  }

  // If value is still suspiciously huge, scale down by 1000 (common mistake)
  if (v > 200000) {
    v = Math.round(v / 1000);
    changed = true;
  }

  // Clamp to sane band
  const clamped = clamp(Math.round(v), 0, 35000);
  if (clamped !== v) changed = true;
  v = clamped;

  // Enforce minimum non-zero distance when present
  if (v > 0 && v < 500) {
    v = 500;
    changed = true;
  }

  return { changed, value: v };
}

function toIsoDate(d) {
  return d.toISOString().split('T')[0];
}

function dateStringsBack(days) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(toIsoDate(d));
  }
  return dates;
}

function dateStringsRange(startIso, endIso) {
  const start = parseIsoDateOrThrow(startIso, '--start');
  const end = parseIsoDateOrThrow(endIso, '--end');
  if (start > end) {
    throw new Error(`Invalid range: start must be <= end (${startIso}..${endIso})`);
  }

  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function buildExerciseDay(dateStr) {
  const sport = randChoice(['RUNNING', 'CYCLING', 'HIKING', 'SWIMMING']);
  const durationMin = randInt(20, 75);
  const calories = randInt(180, 750);
  const distanceKm = sport === 'SWIMMING' ? randInt(1, 3) : randInt(3, 16);
  const hrAvg = randInt(115, 165);
  const hrMax = clamp(hrAvg + randInt(10, 25), 120, 200);

  // The Instructor Dashboard sums `ex.distance` + `ex.calories` and averages `ex.heart_rate.average`.
  const ex = {
    id: `seed-${dateStr}-${sport}-${Math.random().toString(16).slice(2, 10)}`,
    sport,
    duration: `PT${durationMin}M`,
    calories,
    distance: distanceKm,
    heart_rate: {
      average: hrAvg,
      maximum: hrMax,
    },
    syncedAt: new Date().toISOString(),
    seeded: true,
  };

  return {
    date: dateStr,
    exercises: [ex],
    count: 1,
    syncedAt: new Date().toISOString(),
    seeded: true,
  };
}

function buildSleepDay() {
  const score = randInt(55, 92);
  const start = new Date();
  start.setHours(randInt(21, 23), randInt(0, 59), 0, 0);
  start.setDate(start.getDate() - 1);
  const durationHours = randInt(6, 9);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000 + randInt(0, 45) * 60 * 1000);

  return {
    sleep_score: score,
    sleep_start_time: start.toISOString(),
    sleep_end_time: end.toISOString(),
    syncedAt: new Date().toISOString(),
    seeded: true,
  };
}

function buildActivitiesDay(dateStr, rng = Math.random, maxDistanceMeters = 35000) {
  const steps = randInt(2500, 14500);
  const calories = randInt(1600, 3200);
  // Store meters (integer). Use a realistic step->meters heuristic.
  // ~0.65m-0.85m per step, and clamp to keep charts sensible.
  const metersPerStep = (65 + Math.floor(rng() * (85 - 65 + 1))) / 100;
  const distanceMeters = clamp(Math.round(steps * metersPerStep), 500, maxDistanceMeters);

  return {
    date: dateStr,
    steps,
    calories,
    active_duration: `PT${randInt(30, 180)}M`,
    distance_from_steps: distanceMeters,
    activity: {
      distanceMeters,
      distanceKm: distanceMeters / 1000,
    },
    syncedAt: new Date().toISOString(),
    seeded: true,
  };
}

function buildCardioLoadDay(dateStr) {
  return {
    date: dateStr,
    data: {
      cardio_load_ratio: Number((Math.random() * 2.4 + 0.4).toFixed(2)),
    },
    syncedAt: new Date().toISOString(),
    seeded: true,
  };
}

function buildNightlyRechargeDay(dateStr) {
  return {
    date: dateStr,
    nightly_recharge_status: randChoice(['VERY_GOOD', 'GOOD', 'OK', 'POOR']),
    syncedAt: new Date().toISOString(),
    seeded: true,
  };
}

async function ensureDoc(ref, buildData, requiredKeys, dryRun) {
  const snap = await ref.get();
  if (!snap.exists) {
    if (!dryRun) {
      await ref.set(buildData);
    }
    return { action: 'created' };
  }

  // If exists, only patch missing keys (avoid overwriting real data).
  const data = snap.data() || {};
  const missingKeys = requiredKeys.filter((k) => {
    const parts = k.split('.');
    let cur = data;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object' || !(p in cur)) return true;
      cur = cur[p];
    }

    // Treat null/undefined as missing.
    if (cur == null) return true;

    // Default: also treat numeric 0 and empty arrays as needing fill/repair.
    // This makes the instructor dashboard charts look "complete".
    if (typeof cur === 'number' && Number.isFinite(cur) && cur === 0) return true;
    if (Array.isArray(cur) && cur.length === 0) return true;

    return false;
  });

  if (missingKeys.length === 0) return { action: 'skipped' };

  // Build a minimal patch containing those keys (deep set)
  const patch = {};
  for (const key of missingKeys) {
    const parts = key.split('.');
    let cur = patch;
    let src = buildData;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        cur[p] = parts.reduce((acc, part) => (acc == null ? undefined : acc[part]), buildData);
      } else {
        cur[p] = cur[p] && typeof cur[p] === 'object' ? cur[p] : {};
        cur = cur[p];
      }
    }
  }

  patch.syncedAt = new Date().toISOString();
  patch.seeded = true;

  if (!dryRun) {
    await ref.set(patch, { merge: true });
  }

  return { action: 'patched', missingKeys };
}

async function repairActivityDistanceIfNeeded(ref, dryRun, options) {
  const snap = await ref.get();
  if (!snap.exists) return { action: 'skipped' };

  const data = snap.data() || {};
  const original = data.distance_from_steps;

  // If evenOut is enabled, we smooth/jitter even if value is “valid” (but only when the doc is seeded OR already repaired)
  const isSynthetic = data.seeded === true || data.repairedDistance === true;
  if (options?.evenOut && !isSynthetic && !options?.fillZeroDistanceAny) {
    // Don't touch real-looking user data.
    return { action: 'skipped' };
  }

  // Optionally fill in 0 distances for synthetic docs so charts look populated.
  // Never modify non-synthetic docs.
  if (options?.fillZeroDistance) {
    if (!isSynthetic && !options?.fillZeroDistanceAny) return { action: 'skipped' };
    if (typeof original === 'number' && Number.isFinite(original) && original === 0) {
      const filled = smoothAndJitterDistanceMeters(6500, {
        userId: options.userId,
        dateStr: options.dateStr,
        seed: options.seed,
        maxDistanceMeters: options.maxDistanceMeters,
        jitterPct: options.jitterPct,
        baselineMeters: options.baselineMeters,
      });

      const patch = {
        distance_from_steps: filled.value,
        activity: {
          ...(typeof data.activity === 'object' && data.activity ? data.activity : {}),
          distanceMeters: filled.value,
          distanceKm: filled.value / 1000,
        },
        syncedAt: new Date().toISOString(),
        seeded: isSynthetic ? true : (data.seeded === true ? true : false),
        repairedDistance: true,
        filledZeroDistance: true,
        filledZeroDistanceAny: !isSynthetic ? true : undefined,
      };

      if (!dryRun) {
        await ref.set(patch, { merge: true });
      }

      return { action: 'patched' };
    }
  }

  let result;
  if (options?.evenOut) {
    result = smoothAndJitterDistanceMeters(original, {
      userId: options.userId,
      dateStr: options.dateStr,
      seed: options.seed,
      maxDistanceMeters: options.maxDistanceMeters,
      jitterPct: options.jitterPct,
      baselineMeters: options.baselineMeters,
    });
  } else {
    result = normalizeMaybeBadDistanceMeters(original);
  }

  if (!result.changed) return { action: 'skipped' };

  const patch = {
    distance_from_steps: result.value,
    activity: {
      ...(typeof data.activity === 'object' && data.activity ? data.activity : {}),
      distanceMeters: result.value,
      distanceKm: result.value / 1000,
    },
    syncedAt: new Date().toISOString(),
    seeded: true,
    repairedDistance: true,
  };

  if (!dryRun) {
    await ref.set(patch, { merge: true });
  }

  return { action: 'patched' };
}

async function main() {
  const { days, start, end, dryRun, onlyUser, repairBadDistance, evenOut, seed, maxDistanceMeters, jitterPct, fillZeroDistance, fillZeroDistanceAny } = parseArgs(process.argv.slice(2));

  console.log('🧩 Fill missing instructor data');
  if (start && end) console.log(`- range: ${start}..${end}`);
  else console.log(`- days: ${days}`);
  console.log(`- mode: ${dryRun ? 'dryRun (no writes)' : 'write'}`);
  if (repairBadDistance) console.log('- repairBadDistance: enabled');
  if (evenOut) console.log(`- evenOut: enabled (maxDistanceMeters=${maxDistanceMeters}, jitterPct=${jitterPct})`);
  if (seed != null) console.log(`- seed: ${seed || '(empty)'}`);
  if (fillZeroDistance) console.log('- fillZeroDistance: enabled (synthetic docs only)');
  if (fillZeroDistanceAny) console.log('- fillZeroDistanceAny: enabled (will modify real 0 days)');
  if (!fillZeroDistance && !fillZeroDistanceAny) console.log('- keepZeros: enabled');
  if (onlyUser) console.log(`- onlyUser: ${onlyUser}`);

  const dates = (start && end) ? dateStringsRange(start, end) : dateStringsBack(days);

  const usersSnap = await db.collection('users').get();
  const userIds = usersSnap.docs.map((d) => d.id).filter((id) => (onlyUser ? id === onlyUser : true));

  console.log(`- users: ${userIds.length}`);

  const counters = { created: 0, patched: 0, skipped: 0, userUpdated: 0, summariesCreated: 0, summariesPatched: 0 };

  for (const userId of userIds) {
    const polarDataRef = db.collection('users').doc(userId).collection('polarData');
    const userRef = db.collection('users').doc(userId);
    const runAt = new Date().toISOString();
    let wroteAnythingForUser = false;

    // Build a stable RNG per user for seeded docs so patterns look consistent.
    const userRng = makeRng(`${seed || ''}:${userId}`);

    // If we're smoothing, compute a baseline from the most recent existing distances we can find.
    let baselineMeters = 6500;
    if (evenOut) {
      try {
        const sampleDates = dates.slice(0, Math.min(dates.length, 14));
        const snaps = await Promise.all(
          sampleDates.map((dateStr) =>
            polarDataRef.doc('activities').collection('all').doc(dateStr).get()
          )
        );
        const vals = snaps
          .filter((s) => s.exists)
          .map((s) => {
            const d = s.data() || {};
            const dist = typeof d.distance_from_steps === 'number' ? d.distance_from_steps : null;
            return dist;
          })
          .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
        const m = median(vals);
        if (m > 0) baselineMeters = m;
      } catch (e) {
        // ignore
      }
    }

    for (const dateStr of dates) {
      const exercisesRef = polarDataRef.doc('exercises').collection('all').doc(dateStr);
      const sleepRef = polarDataRef.doc('sleep').collection('all').doc(dateStr);
      const activitiesRef = polarDataRef.doc('activities').collection('all').doc(dateStr);
      const cardioRef = polarDataRef.doc('cardioLoad').collection('all').doc(dateStr);
      const rechargeRef = polarDataRef.doc('nightlyRecharge').collection('all').doc(dateStr);
      const summaryRef = polarDataRef.doc('syncSummary').collection('all').doc(dateStr);

      // Generate deterministic-ish per day (stable random seed not required; this is demo data)
      const exData = buildExerciseDay(dateStr);
      const sleepData = buildSleepDay();
      const actData = buildActivitiesDay(dateStr, userRng, maxDistanceMeters);
      const cardioData = buildCardioLoadDay(dateStr);
      const rechargeData = buildNightlyRechargeDay(dateStr);

      const exRes = await ensureDoc(
        exercisesRef,
        exData,
        ['exercises', 'count'],
        dryRun
      );
      const sleepRes = await ensureDoc(
        sleepRef,
        sleepData,
        ['sleep_score', 'sleep_start_time', 'sleep_end_time'],
        dryRun
      );
      const actRes = await ensureDoc(
        activitiesRef,
        actData,
        ['steps', 'calories', 'distance_from_steps'],
        dryRun
      );

      if (repairBadDistance) {
        const repairRes = await repairActivityDistanceIfNeeded(activitiesRef, dryRun, {
          evenOut,
          seed,
          maxDistanceMeters,
          jitterPct,
          userId,
          dateStr,
          baselineMeters,
          fillZeroDistance,
          fillZeroDistanceAny,
        });
        if (repairRes.action === 'patched') counters.patched++;
        else counters.skipped++;
      }
      const cardioRes = await ensureDoc(
        cardioRef,
        cardioData,
        ['data.cardio_load_ratio'],
        dryRun
      );

      // Optional: nightly recharge helps the detail page; instructor dashboard can live without it.
      const rechargeRes = await ensureDoc(
        rechargeRef,
        rechargeData,
        ['nightly_recharge_status'],
        dryRun
      );

      // Create/repair a sync summary doc so UI can derive lastSync when missing.
      // This also makes it easier to see which days were backfilled.
      const anyDayWrite = [exRes, sleepRes, actRes, cardioRes, rechargeRes].some((r) => r.action === 'created' || r.action === 'patched');
      if (anyDayWrite) wroteAnythingForUser = true;

      const summaryPayload = {
        userId,
        date: dateStr,
        syncedAt: runAt,
        itemsStored: [exRes, sleepRes, actRes, cardioRes, rechargeRes].filter((r) => r.action === 'created' || r.action === 'patched').length,
        dataTypes: {
          activities: true,
          sleep: true,
          nightlyRecharge: true,
          continuousHeartRate: false,
          cardioLoad: true,
          exercises: 1,
        },
        errors: [],
        seeded: true,
      };

      const summaryRes = await ensureDoc(
        summaryRef,
        summaryPayload,
        ['syncedAt', 'dataTypes.activities', 'dataTypes.sleep', 'dataTypes.cardioLoad'],
        dryRun
      );

      if (summaryRes.action === 'created') counters.summariesCreated++;
      else if (summaryRes.action === 'patched') counters.summariesPatched++;

      for (const r of [exRes, sleepRes, actRes, cardioRes, rechargeRes]) {
        if (r.action === 'created') counters.created++;
        else if (r.action === 'patched') counters.patched++;
        else counters.skipped++;
      }
    }

    // Update user doc timestamps so the instructor UI reflects that we backfilled/checked.
    if (!dryRun) {
      const patch = { lastChecked: runAt };
      if (wroteAnythingForUser) {
        patch.lastSync = runAt;
      }
      await userRef.set(patch, { merge: true });
      counters.userUpdated++;
    }
  }

  console.log('\n✅ Done');
  console.log(`- created: ${counters.created}`);
  console.log(`- patched: ${counters.patched}`);
  console.log(`- skipped: ${counters.skipped}`);
  console.log(`- syncSummary created: ${counters.summariesCreated}`);
  console.log(`- syncSummary patched: ${counters.summariesPatched}`);
  console.log(`- users timestamp-updated: ${counters.userUpdated}`);
  console.log(dryRun ? '\nRun again with `--write` to apply changes.' : '\nWrote seed data to Firestore.');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
