const { OAuth2Client } = require('google-auth-library');
const sharp = require('sharp');
const { isSchoolEmail } = require('./emailDomain');
const client = new OAuth2Client();
const error = (status, message) => Object.assign(new Error(message), { status });

// Import only the picture from a fresh, verified token for this account. No arbitrary image URLs.
async function getGooglePhoto(token, email, dependencies = {}) {
  if (typeof token !== 'string' || !token) throw error(400, 'Verify your Google Workspace account to sync its photo.');
  if (!process.env.GOOGLE_CLIENT_ID) throw error(503, 'Google photo sync is not configured on the server.');
  let payload;
  try {
    const ticket = await (dependencies.client || client).verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch { throw error(401, 'Google account verification failed. Please try again.'); }
  if (!payload?.email_verified || !isSchoolEmail(payload.email || '') || String(payload.email).toLowerCase() !== email.toLowerCase()) {
    throw error(403, 'Choose the Google Workspace account that matches your signed-in email.');
  }
  return downloadGooglePhoto(payload.picture, dependencies);
}

async function downloadGooglePhoto(picture, dependencies = {}) {
  let url;
  try { url = new URL(picture); } catch { throw error(400, 'This Google account has no available profile photo.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.endsWith('.googleusercontent.com')) {
    throw error(400, 'The Google profile photo URL is not supported.');
  }
  try {
    const response = await (dependencies.fetch || fetch)(url.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.body) throw new Error('Photo unavailable');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) throw new Error('Photo too large');
      chunks.push(Buffer.from(chunk));
    }
    return await sharp(Buffer.concat(chunks), { limitInputPixels: 16000000 }).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
  } catch { throw error(502, 'Could not import your Google photo. Your current photo has been kept.'); }
}

// The menu uses Google's token client; verify the token's audience before trusting userinfo.
async function getGooglePhotoWithAccessToken(accessToken, email, dependencies = {}) {
  if (typeof accessToken !== 'string' || !accessToken) throw error(400, 'Google photo access is required.');
  if (!process.env.GOOGLE_CLIENT_ID) throw error(503, 'Google photo sync is not configured on the server.');
  let info;
  try { info = await (dependencies.client || client).getTokenInfo(accessToken); }
  catch { throw error(401, 'Google photo access expired or could not be verified. Please try again.'); }
  if (info.aud !== process.env.GOOGLE_CLIENT_ID || !(info.expiry_date > Date.now())) {
    throw error(401, 'Google photo access expired or belongs to another application.');
  }
  let payload;
  try {
    const response = await (dependencies.fetch || fetch)('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Profile unavailable');
    payload = await response.json();
  } catch { throw error(502, 'Could not read your Google profile. Your current photo has been kept.'); }
  if (payload?.email_verified !== true || !isSchoolEmail(payload.email || '') || String(payload.email).toLowerCase() !== email.toLowerCase()) {
    throw error(403, 'Choose the Google Workspace account that matches your signed-in email.');
  }
  return downloadGooglePhoto(payload.picture, dependencies);
}

module.exports = { getGooglePhoto, getGooglePhotoWithAccessToken };
