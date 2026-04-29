import { useDb } from '../utils/db';
import { aiQueryRequests } from '../utils/schema';
import { lt, and, isNotNull } from 'drizzle-orm';

export default defineTask({
  async run({ payload, context }) {
    console.log('[Task] Starting Snapshots Cleanup...', new Date().toLocaleString());
    
    try {
      const db = await useDb();
      const now = new Date();

      // 1. ค้นหารายการที่หมดอายุแล้ว (expiresAt < now) และยังมีสถานะ APPROVED
      const expiredRequests = await db.select({
        id: aiQueryRequests.id
      })
      .from(aiQueryRequests)
      .where(and(
        isNotNull(aiQueryRequests.expiresAt),
        lt(aiQueryRequests.expiresAt, now)
      ));

      if (expiredRequests.length === 0) {
        return { result: 'No expired snapshots found.' };
      }

      const storage = useStorage('snapshots');
      let deletedCount = 0;

      for (const req of expiredRequests) {
        const fileName = `${req.id}.csv`;
        // ตรวจสอบว่ามีไฟล์อยู่จริงไหม
        const exists = await storage.hasItem(fileName);
        if (exists) {
          await storage.removeItem(fileName);
          deletedCount++;
          console.log(`[Task] Deleted expired snapshot: ${fileName}`);
        }
      }

      return { 
        result: `Cleanup completed. Found ${expiredRequests.length} expired records, deleted ${deletedCount} files.` 
      };
      
    } catch (error: any) {
      console.error('[Task] Cleanup Error:', error);
      return { error: error.message };
    }
  }
});
