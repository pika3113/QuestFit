import type { VercelRequest, VercelResponse } from '../vercel-types';

/**
 * Mobile Auth Callback Handler
 * 
 * This function handles the redirect from Polar OAuth when on mobile.
 * It receives the authorization code and redirects the user back to the 
 * mobile app using the custom scheme.
 * 
 * Flow:
 * 1. Mobile App opens Polar Auth URL with redirect_uri pointing here
 * 2. User authorizes on Polar
 * 3. Polar redirects here with ?code=...
 * 4. This function redirects to questfit://oauth/polar?code=...
 * 5. Mobile App catches the deep link and resumes the flow
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  // If there's an error from Polar, pass it along
  if (error) {
    return res.redirect(`questfit://oauth/polar?error=${error}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  // Redirect to the mobile app with the code
  // The app should be listening for this scheme
  const mobileRedirectUrl = `questfit://oauth/polar?code=${code}`;
  
  console.log(`Redirecting to mobile app: ${mobileRedirectUrl}`);
  
  // 302 Found redirect
  res.redirect(302, mobileRedirectUrl);
}
