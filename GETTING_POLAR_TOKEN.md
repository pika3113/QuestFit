# How to Get a Polar AccessLink API Token

## Overview
Polar uses OAuth 2.0 authentication, which requires you to register your application and then authenticate a user to get an access token.

## Step 1: Register Your Application

1. **Visit Polar Developer Portal**
   - Go to https://www.polar.com/accesslink-api/
   - Look for "Register Your App" or similar option

2. **Create a Developer Account (if needed)**
   - Sign up or log in with your Polar account
   - Create a new application

3. **Fill in Application Details**
   - Application Name: "QuestFit" (or your app name)
   - Application Type: "Mobile App" or "Native App"
   - Redirect URI: For testing, use something like:
     - `http://localhost:3000/callback` (for web testing)
     - `questfit://callback` (for mobile)

4. **Get Your Credentials**
   - You'll receive:
     - **Client ID** - A unique identifier for your app
     - **Client Secret** - A secret key (keep this safe!)

## Step 2: Authenticate User with OAuth 2.0

There are different flows depending on your setup:

### Option A: For Web Testing (Easiest)

1. **Construct the Authorization URL:**
   ```
   https://www.polaraccesslink.com/oauth2/authorize?
     client_id=YOUR_CLIENT_ID
     &response_type=code
     &redirect_uri=http://localhost:3000/callback
     &scope=ACTIVITY
   ```

2. **Replace `YOUR_CLIENT_ID`** with your actual Client ID

3. **Open in Browser**
   - Copy and paste the full URL into your browser
   - You'll be redirected to Polar's login page
   - Log in with your Polar account
   - Grant permission to your app

4. **Get Authorization Code**
   - You'll be redirected to your redirect URI with a `code` parameter:
     ```
     http://localhost:3000/callback?code=ABC123xyz...
     ```
   - Copy this code

### Step 3: Exchange Code for Access Token

Once you have the authorization code, you need to exchange it for an access token.

**Method 1: Using cURL (Terminal)**

```bash
curl -X POST https://www.polaraccesslink.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3000/callback"
```

Replace:
- `YOUR_AUTHORIZATION_CODE` - The code from Step 2
- `YOUR_CLIENT_ID` - Your Client ID
- `YOUR_CLIENT_SECRET` - Your Client Secret
- `http://localhost:3000/callback` - Your redirect URI

**Method 2: Using Postman**

1. Open Postman
2. Create a new POST request
3. URL: `https://www.polaraccesslink.com/oauth2/token`
4. Headers: `Content-Type: application/x-www-form-urlencoded`
5. Body (form-data):
   - `grant_type`: `authorization_code`
   - `code`: Your authorization code
   - `client_id`: Your Client ID
   - `client_secret`: Your Client Secret
   - `redirect_uri`: Your redirect URI
6. Send and look for `access_token` in the response

**Method 3: Node.js Script**

```javascript
const axios = require('axios');

async function getAccessToken(authCode) {
  try {
    const response = await axios.post(
      'https://www.polaraccesslink.com/oauth2/token',
      {
        grant_type: 'authorization_code',
        code: authCode,
        client_id: 'YOUR_CLIENT_ID',
        client_secret: 'YOUR_CLIENT_SECRET',
        redirect_uri: 'http://localhost:3000/callback'
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    console.log('Access Token:', response.data.access_token);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage: getAccessToken('YOUR_AUTHORIZATION_CODE');
```

## Step 4: Use Your Access Token

Once you have your access token, it looks something like:
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**In QuestFit:**
1. Open the **Polar API** tab
2. Paste the full token in the "Access Token" field
3. Tap **Save Token**
4. Try clicking "Get User Profile" to test

## Scopes Explained

When requesting authorization, you can request different scopes (permissions):

- `ACTIVITY` - Access to exercise data, workouts
- `PHYSICAL_INFO` - Access to physical measurements
- `PROFILE` - Access to user profile
- `HEART_RATE` - Access to heart rate data

Example with multiple scopes:
```
&scope=ACTIVITY+PHYSICAL_INFO+HEART_RATE
```

## Token Expiration & Refresh

- Access tokens typically expire after a set period (usually 1 hour)
- When expired, use the `refresh_token` to get a new access token:

```bash
curl -X POST https://www.polaraccesslink.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

## Troubleshooting

### "Invalid Client ID"
- Double-check your Client ID is correct
- Make sure you copied it exactly from the developer portal

### "Invalid Redirect URI"
- The redirect URI must match EXACTLY what you registered
- Check for typos and https vs http

### "Authorization Code Expired"
- Authorization codes are short-lived (usually 10 minutes)
- You need to get a new one

### "Invalid Access Token" in QuestFit
- Your token may have expired
- Get a new one using the refresh token
- Or go through the OAuth flow again

## For Production

When deploying to production:
- Store `client_secret` securely (never in frontend code)
- Implement proper token refresh logic
- Use HTTPS for all requests
- Consider backend OAuth handling

## Useful Links

- [Polar AccessLink API Docs](https://www.polar.com/accesslink-api/)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [Polar Developer Community](https://community.polar.com/)

## Quick Test

If you just want to test without full OAuth setup:
- Polar sometimes provides test tokens in their sandbox environment
- Check the developer portal for a "Test Token" or "Sandbox" section
- These usually have limited access but work for testing endpoints
