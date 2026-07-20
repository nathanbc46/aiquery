import { useDb } from '../../utils/db';
import { aiZohoConfig } from '../../utils/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const error = query.error as string;

  if (error) {
    return sendRedirect(event, `/admin/ai-settings?zoho=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code) {
    throw createError({ statusCode: 400, message: 'Authorization code missing' });
  }

  const config = useRuntimeConfig();
  const clientId = (config.zohoClientId || process.env.ZOHO_CLIENT_ID) as string;
  const clientSecret = (config.zohoClientSecret || process.env.ZOHO_CLIENT_SECRET) as string;
  const redirectUri = (config.zohoRedirectUri || process.env.ZOHO_REDIRECT_URI) as string;

  try {
    // Exchange code for tokens
    const tokenResponse: any = await $fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      params: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }
    });

    if (tokenResponse.error) {
      throw new Error(tokenResponse.error);
    }

    const { access_token, refresh_token, expires_in } = tokenResponse;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const db = await useDb();

    await db.insert(aiZohoConfig).values({
      id: 'global',
      clientId,
      clientSecret,
      refreshToken: refresh_token,
      accessToken: access_token,
      expiresAt,
    }).onDuplicateKeyUpdate({
      set: {
        clientId,
        clientSecret,
        refreshToken: refresh_token,
        accessToken: access_token,
        expiresAt,
      }
    });

    return sendRedirect(event, '/admin/ai-settings?zoho=connected');

  } catch (e: any) {
    console.error('Zoho Callback Error:', e);
    return sendRedirect(event, `/admin/ai-settings?zoho=error&msg=${encodeURIComponent(e.message)}`);
  }
});
