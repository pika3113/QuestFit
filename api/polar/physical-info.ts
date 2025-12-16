import type { VercelRequest, VercelResponse } from '../vercel-types';
import axios from 'axios';

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, polarUserId } = req.body;

  if (!accessToken || !polarUserId) {
    return res.status(400).json({ error: 'Missing accessToken or polarUserId' });
  }

  try {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Step 1: Create Transaction
    let transactionId;
    let resourceUri;
    
    try {
      const createTransactionResponse = await axios.post(
        `${POLAR_BASE_URL}/users/${polarUserId}/physical-information-transactions`,
        {},
        { headers }
      );
      transactionId = createTransactionResponse.data['transaction-id'];
      resourceUri = createTransactionResponse.data['resource-uri'];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 204) {
        // No content - no new data
        return res.status(200).json({ message: 'No new physical information available', data: [] });
      }
      throw error;
    }

    if (!transactionId || !resourceUri) {
        return res.status(500).json({ error: 'Failed to create transaction' });
    }

    // Step 2: List Physical Infos
    const listResponse = await axios.get(resourceUri, { headers });
    const physicalInfos = listResponse.data['physical-informations'];

    const collectedData = [];

    // Step 3: Get Physical Info Data
    for (const infoUrl of physicalInfos) {
      const infoResponse = await axios.get(infoUrl, { headers });
      collectedData.push(infoResponse.data);
    }

    // Step 4: Commit Transaction
    if (transactionId) {
        await axios.put(
            `${POLAR_BASE_URL}/users/${polarUserId}/physical-information-transactions/${transactionId}`,
            {},
            { headers }
        );
    }

    // Return the collected data
    return res.status(200).json({ 
        message: 'Physical information synced successfully', 
        data: collectedData 
    });

  } catch (error) {
    console.error('Error syncing Polar physical info:', error);
    
    if (axios.isAxiosError(error)) {
      return res.status(error.response?.status || 500).json({
        error: 'Failed to sync physical info from Polar',
        details: error.response?.data,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
