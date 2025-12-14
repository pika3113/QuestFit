import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminToken = process.env.POLAR_WEBHOOK_ADMIN_TOKEN;
  const presentedToken = (req.headers['x-webhook-admin-token'] as string | undefined) || '';
  if (!adminToken) {
    return res.status(500).json({ error: 'Missing POLAR_WEBHOOK_ADMIN_TOKEN in environment' });
  }
  if (!presentedToken || presentedToken !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Generate Basic Auth from environment variables
  const clientId = process.env.POLAR_ACCESSLINK_CLIENT_ID;
  const clientSecret = process.env.POLAR_ACCESSLINK_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing Polar credentials in environment' });
  }
  
  const BASIC_AUTH = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      'https://www.polaraccesslink.com/v3/webhooks',
      {
        events: ['EXERCISE', 'SLEEP', 'CONTINUOUS_HEART_RATE', 'ACTIVITY_SUMMARY'],
        url: `${process.env.EXPO_PUBLIC_BASE_URL || 'https://questfit.life'}/api/polar/webhook`
      },
      {
        headers: {
          'Authorization': `Basic ${BASIC_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          
        },
      }
    );

    console.log('Webhook created successfully:', response.data);
    
    return res.status(201).json({
      success: true,
      data: response.data,
      signatureSecret: response.data?.data?.signature_secret_key,
      nextStep: 'Set POLAR_WEBHOOK_SIGNATURE_SECRET to signatureSecret (then redeploy).',
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    
    if (axios.isAxiosError(error)) {
      // 409 means webhook already exists
      if (error.response?.status === 409) {
        return res.status(200).json({
          success: true,
          alreadyExists: true,
          message: 'Webhook already exists',
        });
      }

      return res.status(error.response?.status || 500).json({
        error: 'Failed to create webhook',
        details: error.response?.data || error.message,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
