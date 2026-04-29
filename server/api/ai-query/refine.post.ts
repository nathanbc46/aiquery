import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { prompt } = body;

  if (!prompt) {
    return { success: false, error: 'กรุณาระบุคำถาม' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน .env' };
  }

  const db = await useDb();
  let modelName = 'gemini-3.1-flash-lite-preview';
  let systemPrompt = `
คุณคือผู้เชี่ยวชาญด้านการเขียน Prompt สำหรับระบบ Text-to-SQL (Vtiger CRM).
หน้าที่ของคุณคือรับ "คำถามภาษาไทย" จากผู้ใช้ และปรับปรุงให้เป็นประโยคที่ชัดเจนขึ้น เพื่อให้ AI ตัวอื่นนำไปสร้าง SQL ได้ถูกต้องที่สุด.

กฎการทำงาน:
1. คงเนื้อหาเดิมของผู้ใช้ไว้ แต่ขยายความให้ชัดเจน (เช่น ระบุชื่อตารางที่เกี่ยวข้อง: Accounts, Contacts, Products, SalesOrder).
2. ถ้าผู้ใช้ไม่ได้ระบุ Column ให้แนะนำ Column พื้นฐานที่ควรมี (เช่น ชื่อบริษัท, เบอร์โทร, วันที่สร้าง).
3. ใช้ภาษาไทยที่สุภาพและเป็นมืออาชีพ.
4. ตอบกลับเฉพาะ "ประโยคที่ปรับปรุงแล้วเท่านั้น" ไม่ต้องมีคำอธิบายอื่น.
  `.trim();

  try {
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const config = settings[0];
    if (config) {
      modelName = config.refineModel;
      systemPrompt = config.refineSystemPrompt;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent([systemPrompt, prompt as string]);
    const refinedText = result.response.text().trim();

    return {
      success: true,
      refinedText
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
