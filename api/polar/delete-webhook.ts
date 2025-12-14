import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
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
    // Step 1: Get the webhook ID
    console.log('Fetching webhook list...');
    const getResponse = await axios.get(
      'https://www.polaraccesslink.com/v3/webhooks',
      {
        headers: {
          'Authorization': `Basic ${BASIC_AUTH}`,
          'Accept': 'application/json',
        },
      }
    );

    console.log('Webhook list response:', getResponse.data);

    // Check if any webhooks exist
    if (!getResponse.data?.data || getResponse.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No webhooks found',
      });
    }

    // Get the first webhook's ID (assuming you only have one)
    const webhookId = getResponse.data.data[0].id;
    console.log('Found webhook ID:', webhookId);

    // Step 2: Delete the webhook
    console.log('Deleting webhook...');
    await axios.delete(
      `https://www.polaraccesslink.com/v3/webhooks/${webhookId}`,
      {
        headers: {
          'Authorization': `Basic ${BASIC_AUTH}`,
        },
      }
    );

    console.log('Webhook deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Webhook deleted successfully',
      deletedWebhookId: webhookId,
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);

    if (axios.isAxiosError(error)) {
      // 404 means webhook not found
      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          message: 'Webhook not found',
        });
      }

      return res.status(error.response?.status || 500).json({
        error: 'Failed to delete webhook',
        details: error.response?.data || error.message,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
