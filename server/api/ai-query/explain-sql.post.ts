import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_REFINE_MODEL } from '../../utils/constants';
import { logTokenUsage } from '../../utils/tokenLogger';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql } = body;

  if (!sql) {
    return { success: false, error: 'กรุณาระบุคำสั่ง SQL' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน .env' };
  }

  try {
    const db = await useDb();
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const modelName = settings[0]?.refineModel || DEFAULT_REFINE_MODEL;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `คุณคือผู้เชี่ยวชาญด้านฐานข้อมูล Vtiger CRM ที่สามารถอ่านคำสั่ง SQL และแปลงเป็นภาษาไทยที่คนทั่วไปเข้าใจได้
ตอบกลับเป็น JSON เท่านั้น ไม่มี Markdown code block ไม่มีข้อความอื่น รูปแบบดังนี้:
{
  "humanReadable": "ประโยคสั้น 1-2 ประโยคที่อธิบายว่าต้องการข้อมูลอะไร เขียนเหมือนคนถามตามปกติ",
  "explanation": "อธิบายรายละเอียดของ SQL เป็น Markdown bullet list ภาษาไทย ครอบคลุม: ต้องการข้อมูลอะไร, เงื่อนไขที่ใช้กรอง, ตารางที่ดึง, และข้อสังเกตสำคัญ ใช้ **bold** สำหรับชื่อตาราง ชื่อ field หรือเงื่อนไขสำคัญ"
}`
    });

    const explainStart = Date.now()
    const result = await model.generateContent(
      `แปลง SQL คำสั่งนี้เป็นภาษาไทยที่คนทั่วไปเข้าใจ:\n\n${sql}`
    );
    const explainUsage = result.response.usageMetadata
    logTokenUsage({
      endpoint: 'explain',
      modelUsed: modelName,
      userId: session.userId,
      tokensIn: explainUsage?.promptTokenCount ?? 0,
      tokensOut: explainUsage?.candidatesTokenCount ?? 0,
      durationMs: Date.now() - explainStart,
    })

    const raw = result.response.text().trim();

    let parsed: { humanReadable: string; explanation: string };
    try {
      // ลบ markdown code block ถ้ามี
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // fallback ถ้า parse ไม่ได้
      parsed = {
        humanReadable: 'คำสั่ง SQL โดยตรง',
        explanation: raw
      };
    }

    return {
      success: true,
      humanReadable: parsed.humanReadable || 'คำสั่ง SQL โดยตรง',
      explanation: parsed.explanation || raw
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
