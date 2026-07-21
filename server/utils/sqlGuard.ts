import { createError } from 'h3'

// ชื่อ column ที่ห้ามดึงออก — passwords, tokens, API keys, secrets
export const SENSITIVE_COLUMN_PATTERNS = [
  // Passwords
  'password', 'passwd', 'user_password', 'confirm_password',
  // Tokens & keys
  'token', 'access_token', 'refresh_token', 'auth_token',
  'api_key', 'apikey', 'accesskey',
  // Secrets
  'secret', 'secret_key', 'client_secret',
  'private_key', 'auth_key', 'encryption_key',
  // Auth hashes
  'auth_string', 'auth_hash', 'credential',
]

/**
 * ตรวจสอบว่า SQL พยายาม select/expose sensitive columns หรือไม่
 * ถ้าเจอ — throw 403 error ทันที
 */
export function guardSensitiveSql(sqlText: string): void {
  const upper = sqlText.toUpperCase()
  for (const col of SENSITIVE_COLUMN_PATTERNS) {
    const pattern = new RegExp(`\\b${col.toUpperCase()}\\b`)
    if (pattern.test(upper)) {
      throw createError({
        statusCode: 403,
        statusMessage: `Security: SQL references restricted column '${col}'. Passwords, tokens, and secret keys cannot be queried.`,
      })
    }
  }
}

/**
 * เวอร์ชัน throw Error ปกติ (สำหรับใช้ใน context ที่ไม่ใช่ event handler โดยตรง)
 * เช่น ใน extractSql ของ chat-sql
 */
export function assertNoSensitiveSql(sqlText: string): void {
  const upper = sqlText.toUpperCase()
  for (const col of SENSITIVE_COLUMN_PATTERNS) {
    const pattern = new RegExp(`\\b${col.toUpperCase()}\\b`)
    if (pattern.test(upper)) {
      throw new Error(`Security: SQL references restricted column '${col}'`)
    }
  }
}
