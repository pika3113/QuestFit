import OpenAI from 'openai';
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from '../vercel-types';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

type ActivityMetric = 'steps' | 'distance';

type CadetInput = {
  cadetId: string;
  displayName: string;
  isLightDuty?: boolean;
  avgSteps: number;
  avgDistance: number;
  avgCalories: number;
  avgSleep: number;
  avgHr: number;
  lastSync?: string;
  trend?: 'up' | 'down' | 'stable';
};

type Flag = 'good' | 'bad' | 'none';

type FlagResult = {
  cadetId: string;
  flag: Flag;
  reason: string;
};

function coerceBodyObject(body: unknown): Record<string, unknown> | null {
  if (!body) return null;

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (body instanceof Uint8Array) {
    try {
      const asString = typeof Buffer !== 'undefined'
        ? Buffer.from(body).toString('utf8')
        : new TextDecoder('utf-8').decode(body);
      return JSON.parse(asString) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') return body as Record<string, unknown>;
  return null;
}

function isCadetInput(value: unknown): value is CadetInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const isLightDutyOk = v.isLightDuty === undefined || typeof v.isLightDuty === 'boolean';
  return (
    typeof v.cadetId === 'string' &&
    typeof v.displayName === 'string' &&
    isLightDutyOk &&
    typeof v.avgSteps === 'number' &&
    typeof v.avgDistance === 'number' &&
    typeof v.avgCalories === 'number' &&
    typeof v.avgSleep === 'number' &&
    typeof v.avgHr === 'number'
  );
}

function normalizeFlag(flag: unknown): Flag {
  if (flag === 'good' || flag === 'bad' || flag === 'none') return flag;
  return 'none';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.OPEN_AI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPEN_AI_API_KEY' });
    }

    const parsed = coerceBodyObject(req.body);
    if (!parsed) return res.status(400).json({ error: 'Invalid body' });

    const activityMetric = parsed.activityMetric === 'steps' || parsed.activityMetric === 'distance'
      ? (parsed.activityMetric as ActivityMetric)
      : 'steps';

    const cohortRaw = parsed.cohort;
    if (!Array.isArray(cohortRaw) || cohortRaw.length === 0) {
      return res.status(400).json({ error: 'Missing cohort' });
    }

    const cohort = cohortRaw.filter(isCadetInput);
    if (cohort.length === 0) return res.status(400).json({ error: 'Invalid cohort items' });

    const rangeLabel = typeof parsed.rangeLabel === 'string' ? parsed.rangeLabel : 'recent period';

    const systemText = [
      'You are an instructor performance analyst for a fitness cadet cohort.',
      'You must flag cadets as good, bad, or none based on the provided averages.',
      'Prefer conservative flagging: only flag clear good/bad cases.',
      'Some cadets are marked isLightDuty=true (LD). They may do less PT than others.',
      'For LD cadets, be more lenient: do NOT flag bad for low activity alone. Only flag bad if there is clear, extreme concern (e.g., very poor trend or consistently zero data), otherwise prefer none.',
      'Keep reasons short (<= 12 words), concrete, and data-backed.',
      'If data is missing (e.g., sleep=0), mention it in the reason and be conservative.',
      'Return ONLY JSON. No markdown. No surrounding text.',
    ].join(' ');

    const prompt = {
      rangeLabel,
      activityMetric,
      cohort,
      policy: {
        maxGoodFraction: 0.25,
        maxBadFraction: 0.25,
        minCohortSizeForFlags: 3,
      },
      outputSchema: {
        flags: [{ cadetId: 'string', flag: 'good|bad|none', reason: 'string' }],
      },
    };

    // Mirror the working API usage in api/openai/generate-summary.ts (content as input_text blocks).
    // @ts-ignore - Using experimental/beta API
    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        {
          role: 'system',
          content: [
            { type: 'input_text', text: systemText },
            { type: 'input_text', text: JSON.stringify(prompt) },
          ],
        },
      ],
      instructions:
        'Return a JSON object with a single field "flags": an array of {cadetId, flag, reason}. flag must be one of good|bad|none. Do not include any other fields.',
      store: false,
      reasoning: { effort: 'low' },
    });

    // @ts-ignore
    const content = response.output_text;
    let obj: any;
    try {
      obj = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Failed to parse OpenAI response', raw: content });
    }

    const flagsRaw = Array.isArray(obj?.flags) ? obj.flags : [];
    const results: FlagResult[] = flagsRaw
      .map((r: any) => {
        const cadetId = typeof r?.cadetId === 'string' ? r.cadetId : '';
        const flag = normalizeFlag(r?.flag);
        const reason = typeof r?.reason === 'string' ? r.reason : '';
        return { cadetId, flag, reason };
      })
      .filter((r: FlagResult) => r.cadetId.length > 0);

    // Ensure we only return results for cadets we were given
    const allowed = new Set(cohort.map((c) => c.cadetId));
    const filteredResults = results.filter((r) => allowed.has(r.cadetId));

    return res.status(200).json({
      activityMetric,
      rangeLabel,
      flags: filteredResults,
      model: 'gpt-5-nano',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('auto-flag-cohort error', err);
    return res.status(500).json({ error: 'Internal server error', message });
  }
}
