import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId || session.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Only admins can authorize Zoho integration' });
  }

  const config = useRuntimeConfig();
  const clientId = (config.zohoClientId || process.env.ZOHO_CLIENT_ID) as string;
  const redirectUri = (config.zohoRedirectUri || process.env.ZOHO_REDIRECT_URI) as string;

  if (!clientId || !redirectUri) {
    throw createError({ statusCode: 500, message: 'Zoho configuration missing in .env' });
  }

  // Scopes needed for Zoho Sheet API v2 + WorkDrive for file placement
  const scopes = [
    'ZohoSheet.dataAPI.READ',
    'ZohoSheet.dataAPI.UPDATE',
    'WorkDrive.files.ALL',
    'WorkDrive.links.ALL'
  ].join(',');

  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` + 
    `scope=${scopes}&` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `prompt=consent&state=${Date.now()}`;

  return sendRedirect(event, authUrl);
});
