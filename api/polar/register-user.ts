import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, userId } = req.body;

  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'Missing accessToken or userId' });
  }

  try {
    const response = await axios.post(
      'https://www.polaraccesslink.com/v3/users',
      { 'member-id': userId },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      return res.status(200).json({ success: true, alreadyRegistered: true });
    }

    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Failed to register',
      details: axios.isAxiosError(error) ? error.response?.data : error
    });
  }
}
