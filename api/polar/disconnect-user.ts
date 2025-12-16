import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, polarUserId } = req.body;

  if (!accessToken || !polarUserId) {
    return res.status(400).json({ error: 'Missing accessToken or polarUserId' });
  }

  try {
    await axios.delete(
      `https://www.polaraccesslink.com/v3/users/${polarUserId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return res.status(200).json({ success: true, message: 'User deleted from Polar' });
  } catch (error) {
    console.error('Error deleting Polar user:', error);
    
    if (axios.isAxiosError(error)) {
      return res.status(error.response?.status || 500).json({
        error: 'Failed to delete user from Polar',
        details: error.response?.data || error.message,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
