import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_REFINE_MODEL, DEFAULT_GENERATE_INSTRUCTION } from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql, error } = body;

  if (!sql || !error) {
    return { success: false, suggestion: null };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, suggestion: null };
  }

  try {
    const db = await useDb();
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const config = settings[0];
    const modelName = config?.refineModel || DEFAULT_REFINE_MODEL;
    const schemaContext = config?.generateSystemInstruction || DEFAULT_GENERATE_INSTRUCTION;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `คุณคือผู้เชี่ยวชาญ MySQL และ Vtiger CRM ที่ช่วยแก้ไข SQL Error
นี่คือ Schema Context ของ Vtiger CRM ที่ใช้งานอยู่:
${schemaContext}

กฎการตอบ:
- ตอบเป็น JSON เท่านั้น ไม่มี Markdown code block ไม่มีข้อความอื่น
- รูปแบบ: { "cause": "สาเหตุของ error เป็นภาษาไทย 1-2 ประโยค", "fix": "วิธีแก้ไขเป็นภาษาไทย 1-3 ประโยค", "fixedSql": "คำสั่ง SQL ที่แก้ไขแล้ว หรือ null ถ้าแก้ไม่ได้" }
- fixedSql ต้องเป็น SELECT/WITH query เท่านั้น ห้าม INSERT/UPDATE/DELETE
- ถ้าแก้ไม่ได้ให้ fixedSql เป็น null`
    });

    const result = await model.generateContent(
      `SQL ที่รัน:\n${sql}\n\nError ที่เกิดขึ้น:\n${error}\n\nกรุณาวิเคราะห์สาเหตุและแนะนำวิธีแก้ไข`
    );

    const raw = result.response.text().trim();
    let parsed: { cause: string; fix: string; fixedSql: string | null };

    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return { success: false, suggestion: null };
    }

    return {
      success: true,
      suggestion: {
        cause: parsed.cause || '',
        fix: parsed.fix || '',
        fixedSql: parsed.fixedSql || null
      }
    };
  } catch (e: any) {
    console.error('Fix SQL Error:', e);
    return { success: false, suggestion: null };
  }
});
