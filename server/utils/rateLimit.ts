import type { H3Event } from 'h3';
import { getRequestIP } from 'h3';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// ตรวจสอบ rate limit; โยน 429 ถ้าเกินขีดจำกัด
export const checkLoginRateLimit = (event: H3Event, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const key = `login:${ip}`;
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;
  if (entry.count > maxAttempts) {
    const waitSecs = Math.ceil((entry.resetAt - now) / 1000);
    throw createError({
      statusCode: 429,
      message: `พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ใน ${waitSecs} วินาที`,
      data: { retryAfter: waitSecs },
    });
  }
};

// เคลียร์ counter หลังล็อกอินสำเร็จ
export const clearLoginRateLimit = (event: H3Event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  store.delete(`login:${ip}`);
};
