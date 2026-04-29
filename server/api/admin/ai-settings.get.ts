import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { VTIGER_SCHEMA } from '../../utils/vtigerSchema';
import { 
  DEFAULT_MAX_RESULTS_LIMIT,
  DEFAULT_ANALYZE_MODEL,
  DEFAULT_ANALYZE_INSTRUCTION,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_INSTRUCTION,
  DEFAULT_REFINE_MODEL,
  DEFAULT_GENERATE_MODEL
} from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const db = await useDb();

  try {
    const results = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    
    if (results.length > 0) {
      return { success: true, settings: results[0] };
    }

    // Default Values if not set
    const defaultSettings = {
      id: 'global',
      refineModel: DEFAULT_REFINE_MODEL,
      refineSystemPrompt: `
คุณคือผู้เชี่ยวชาญด้านการเขียน Prompt สำหรับระบบ Text-to-SQL (Vtiger CRM).
หน้าที่ของคุณคือรับ "คำถามภาษาไทย" จากผู้ใช้ และปรับปรุงให้เป็นประโยคที่ชัดเจนขึ้น เพื่อให้ AI ตัวอื่นนำไปสร้าง SQL ได้ถูกต้องที่สุด.

กฎการทำงาน:
1. คงเนื้อหาเดิมของผู้ใช้ไว้ แต่ขยายความให้ชัดเจน (เช่น ระบุชื่อตารางที่เกี่ยวข้อง: Accounts, Contacts, Products, SalesOrder).
2. ถ้าผู้ใช้ไม่ได้ระบุ Column ให้แนะนำ Column พื้นฐานที่ควรมี (เช่น ชื่อบริษัท, เบอร์โทร, วันที่สร้าง).
3. ใช้ภาษาไทยที่สุภาพและเป็นมืออาชีพ.
4. ตอบกลับเฉพาะ "ประโยคที่ปรับปรุงแล้วเท่านั้น" ไม่ต้องมีคำอธิบายอื่น.
      `.trim(),
      generateModel: DEFAULT_GENERATE_MODEL,
      generateSystemInstruction: VTIGER_SCHEMA,
      analyzeModel: DEFAULT_ANALYZE_MODEL,
      analyzeSystemInstruction: DEFAULT_ANALYZE_INSTRUCTION,
      chatModel: DEFAULT_CHAT_MODEL,
      chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION,
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT
    };

    return { success: true, settings: defaultSettings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
