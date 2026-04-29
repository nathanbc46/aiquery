import { getDbStatus, useDb } from '../../utils/db'
import { aiQueryRequests } from '../../utils/schema'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: process.env.SESSION_PASSWORD || 'a_very_long_and_secure_password_for_session_encryption',
  });
  const userId = (session.data as any).userId;

  const isDbConnected = await getDbStatus()
  let pendingCount = 0
  let myPendingCount = 0

  if (isDbConnected) {
    try {
      const db = await useDb()
      
      // 1. จำนวนรายการรอนุมัติทั้งหมด (สำหรับ Manager/Admin)
      const globalResult = await db.select({ count: sql<number>`count(*)` })
        .from(aiQueryRequests)
        .where(eq(aiQueryRequests.status, 'PENDING'))
      
      pendingCount = globalResult[0]?.count || 0

      // 2. จำนวนรายการรอนุมัติของตัวเอง (สำหรับ User ทั่วไป)
      if (userId) {
        const userResult = await db.select({ count: sql<number>`count(*)` })
          .from(aiQueryRequests)
          .where(sql`${aiQueryRequests.status} = 'PENDING' AND ${aiQueryRequests.userId} = ${userId}`)
        
        myPendingCount = userResult[0]?.count || 0
      }
    } catch (e) {
      console.error('Failed to fetch pending counts:', e)
    }
  }
  
  return {
    success: true,
    status: isDbConnected ? 'online' : 'offline',
    database: isDbConnected ? 'Connected' : 'Disconnected',
    pendingApprovals: pendingCount,
    myPendingRequests: myPendingCount,
    timestamp: new Date().toISOString()
  }
})
