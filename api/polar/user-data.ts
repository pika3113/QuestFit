import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let accessToken: string | undefined;
  let polarUserId: string | undefined;

  // `req.body` is typed as unknown in our Vercel types; validate at runtime.
  // On Vercel this may arrive as an object (already parsed) OR as raw bytes.
  const coerceBodyObject = (body: unknown): Record<string, unknown> | null => {
    if (!body) return null;

    if (typeof body === 'string') {
      try {
        return JSON.parse(body) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    // Raw bytes
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

    if (typeof body === 'object') {
      return body as Record<string, unknown>;
    }

    return null;
  };

  const parsed = coerceBodyObject(req.body);
  accessToken = parsed && typeof parsed.accessToken === 'string' ? parsed.accessToken : undefined;
  polarUserId = parsed && typeof parsed.polarUserId === 'string' ? parsed.polarUserId : undefined;

  if (!accessToken || !polarUserId) {
    return res.status(400).json({ error: 'Missing accessToken or polarUserId' });
  }

  try {
    // Fetch user physical data from Polar API
    const response = await axios.get(
      `https://www.polaraccesslink.com/v3/users/${polarUserId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    // Return the physical data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching Polar user data:', error);
    
    if (axios.isAxiosError(error)) {
      return res.status(error.response?.status || 500).json({
        error: 'Failed to fetch user data from Polar',
        details: error.response?.data,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
