import { useDb } from './db';
import { sql } from 'drizzle-orm';

export async function getValidZohoToken() {
  const db = await useDb();
  const [configs]: any = await db.execute(sql`SELECT * FROM ai_zoho_config WHERE id = 'global' LIMIT 1`);
  const config = configs[0];

  if (!config || !config.refresh_token) {
    throw new Error('Zoho is not authorized. Please visit /api/zoho/auth first.');
  }

  // Check if access token is still valid (with 5 min buffer)
  const now = new Date();
  const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
  
  const expiresDate = config.expires_at instanceof Date
    ? config.expires_at
    : new Date(String(config.expires_at).replace(' ', 'T') + 'Z');
  if (config.access_token && expiresDate > bufferTime) {
    return config.access_token;
  }

  // Token expired or missing, refresh it
  console.log('Refreshing Zoho Access Token...');
  const tokenResponse: any = await $fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    params: {
      refresh_token: config.refresh_token,
      client_id: config.client_id,
      client_secret: config.client_secret,
      grant_type: 'refresh_token'
    }
  });

  if (tokenResponse.error) {
    throw new Error(`Failed to refresh Zoho token: ${tokenResponse.error}`);
  }

  const newAccessToken = tokenResponse.access_token;
  const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
  const newExpiresAtStr = newExpiresAt.toISOString().slice(0, 19).replace('T', ' ');

  // ใช้ parameterized query เพื่อป้องกัน special chars ใน token พัง SQL
  await db.execute(sql`
    UPDATE ai_zoho_config
    SET access_token = ${newAccessToken},
        expires_at   = ${newExpiresAtStr}
    WHERE id = 'global'
  `);

  return newAccessToken;
}

/**
 * Find a WorkDrive file by name inside a folder, return its WorkDrive ID
 */
/**
 * Get the parent folder ID of a given WorkDrive folder/file
 */
export async function getWorkDriveParentFolderId(accessToken: string, resourceId: string): Promise<string | null> {
  try {
    const res: any = await $fetch(`https://www.zohoapis.com/workdrive/api/v1/files/${resourceId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return res?.data?.attributes?.parent_id ?? null;
  } catch (e: any) {
    console.warn('getWorkDriveParentFolderId error:', e.message);
    return null;
  }
}

export async function findWorkDriveFileId(accessToken: string, folderId: string, fileName: string): Promise<string | null> {
  try {
    // Sort by modified time DESC so the newest file appears first
    const res: any = await $fetch(
      `https://www.zohoapis.com/workdrive/api/v1/files/${folderId}/files?sort_by=modified_time&sort_order=DESC&limit=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const files = res?.data ?? [];
    if (fileName === '__DEBUG_LIST__') {
      return files.map((f: any) => f.attributes?.name).join(' | ');
    }
    const match = files.find((f: any) => {
      const name = f.attributes?.name ?? '';
      return name === fileName || name.startsWith(fileName);
    });
    return match?.id ?? null;
  } catch (e: any) {
    return `ERROR: ${e.message}`;
  }
}

/**
 * Move a WorkDrive file to a specific folder
 */
export async function moveWorkDriveFile(accessToken: string, resourceId: string, targetFolderId: string) {
  const res = await fetch(`https://www.zohoapis.com/workdrive/api/v1/files/${resourceId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      data: {
        id: resourceId,
        attributes: { parent_id: targetFolderId },
        type: 'files'
      }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WorkDrive PATCH ${res.status}: ${body}`);
  }
}

/**
 * Get the Private Space ID (Root Folder) for the current WorkDrive user
 */
export async function getWorkDrivePrivateSpaceId(accessToken: string) {
  try {
    // 1. Get My Profile to get ZUID
    // WorkDrive V1 API often expects 'Bearer' instead of 'Zoho-oauthtoken'
    const userResponse: any = await $fetch('https://www.zohoapis.com/workdrive/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const zuid = userResponse.data.id;

    // 2. Get Private Space ID
    const spaceResponse: any = await $fetch(`https://www.zohoapis.com/workdrive/api/v1/users/${zuid}/privatespace`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    return spaceResponse.data.id;
  } catch (e: any) {
    console.error('WorkDrive PrivateSpace Error:', e.response?._data || e.message);
    throw new Error(`WorkDrive API Error (PrivateSpace): ${JSON.stringify(e.response?._data) || e.message}`);
  }
}

/**
 * Find or Create a folder in WorkDrive
 */
export async function getOrCreateWorkDriveFolder(accessToken: string, parentId: string, folderName: string) {
  try {
    // 1. Check if folder exists
    const listResponse: any = await $fetch(`https://www.zohoapis.com/workdrive/api/v1/files/${parentId}/files`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const existingFolder = listResponse.data.find((f: any) => 
      f.attributes.name === folderName && f.attributes.is_folder === true && f.attributes.status === 'active'
    );

    if (existingFolder) {
      return existingFolder.id;
    }

    // 2. Create new folder
    const createResponse: any = await $fetch('https://www.zohoapis.com/workdrive/api/v1/files', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: {
        data: {
          attributes: {
            name: folderName,
            parent_id: parentId
          },
          type: 'files'
        }
      }
    });

    return createResponse.data.id;
  } catch (e: any) {
    console.error('WorkDrive Folder Error:', e.response?._data || e.message);
    throw new Error(`WorkDrive API Error (Folder): ${JSON.stringify(e.response?._data) || e.message}`);
  }
}
