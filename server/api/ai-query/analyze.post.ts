import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiQueryRequests, aiSettings } from '../../utils/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { logTokenUsage } from '../../utils/tokenLogger';

import { 
  DEFAULT_ANALYZE_MODEL, 
  DEFAULT_ANALYZE_INSTRUCTION, 
  DEFAULT_MAX_RESULTS_LIMIT 
} from '../../utils/constants';

export default defineEventHandler(async (event) => {
  // 1. ตรวจสอบสิทธิ์เบื้องต้น
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { requestId } = body;

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing requestId' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const db = await useDb();

    // 1. ดึงข้อมูล Settings จาก DB
    const settingsRows = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const settings = settingsRows[0] || {
      analyzeModel: DEFAULT_ANALYZE_MODEL,
      analyzeSystemInstruction: DEFAULT_ANALYZE_INSTRUCTION,
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT
    };

    // 2. ดึงข้อมูลคำขอจาก DB
    const [request] = await db.select()
      .from(aiQueryRequests)
      .where(eq(aiQueryRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw createError({ statusCode: 404, statusMessage: 'Request not found' });
    }

    // ตรวจสอบว่าผู้ขอเป็นเจ้าของ หรือเป็น Manager/Admin
    if (request.userId !== session.userId && session.role === 'user') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: You can only analyze your own requests' });
    }

    if (request.status !== 'APPROVED') {
      throw createError({ statusCode: 403, statusMessage: 'Only approved requests can be analyzed' });
    }

    // 2. ดึงข้อมูลจาก Snapshot Storage
    const storage = useStorage('snapshots');
    const csv: any = await storage.getItem(`${requestId}.csv`);

    if (!csv) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'ไม่พบไฟล์ Snapshot กรุณาติดต่อผู้ดูแลระบบ' 
      });
    }

    // 3. เตรียมข้อมูลสำหรับส่งให้ AI (ดึงจาก CSV)
    const lines = csv.split('\n').filter((l: string) => l.trim() !== '');
    const rowCount = lines.length > 0 ? lines.length - 1 : 0; // หัก Header ออก
    const columns = lines[0] ? lines[0].split(',') : [];

    // เลือกตัวอย่างข้อมูล (ส่งได้สูงสุด 5000 แถว)
    const sampleText = lines.slice(0, 5001).join('\n');
    const dataText = [
      `คอลัมน์: ${columns.join(', ')}`,
      `จำนวนแถวทั้งหมด: ${rowCount} แถว`,
      '',
      sampleText
    ].join('\n');

    // 4. ส่งข้อมูลให้ Gemini สรุป
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: settings.analyzeModel || DEFAULT_ANALYZE_MODEL,
      systemInstruction: settings.analyzeSystemInstruction
    });

    const analyzePrompt = `คำขอข้อมูลเดิม: "${request.queryText}"

ผลข้อมูลที่ได้:
${dataText}

กรุณาสรุปข้อมูลนี้ในแง่มุมที่มีประโยชน์ต่อธุรกิจ ครอบคลุม:
1. ภาพรวมของข้อมูล (จำนวน, ช่วงเวลา ฯลฯ)
2. ประเด็นสำคัญที่ควรรู้
3. ข้อสังเกตหรือ Pattern ที่น่าสนใจ (ถ้ามี)
4. ข้อเสนอแนะเพิ่มเติม (ถ้ามี)

**สำคัญมาก:** หากพบว่ามีข้อมูลสถิติใดที่สามารถจัดกลุ่มและแสดงผลเป็นกราฟได้ (เช่น Pie chart, Bar chart) เพื่อให้เข้าใจง่ายขึ้น ให้คุณสรุปและสร้างกราฟประกอบมาด้วยเสมอ โดยใช้รูปแบบ JSON block นี้เท่านั้น:

\`\`\`chart
{
  "type": "bar",
  "title": "ชื่อกราฟ",
  "categories": ["ป้ายกำกับ 1", "ป้ายกำกับ 2"],
  "series": [{ "name": "ชื่อชุดข้อมูล", "data": [100, 200] }]
}
\`\`\`

สำหรับกราฟ pie หรือ donut ให้ใช้รูปแบบ:
\`\`\`chart
{
  "type": "pie",
  "title": "ชื่อกราฟ",
  "labels": ["ป้ายกำกับ 1", "ป้ายกำกับ 2"],
  "series": [100, 200]
}
\`\`\`

ประเภทที่ใช้ได้: bar, line, area, pie, donut เท่านั้น ห้ามใช้รูปแบบอื่น`;

    const analyzeStart = Date.now()
    const result = await model.generateContent(analyzePrompt);
    const analyzeUsage = result.response.usageMetadata
    logTokenUsage({
      endpoint: 'analyze',
      modelUsed: settings.analyzeModel || DEFAULT_ANALYZE_MODEL,
      userId: session.userId,
      tokensIn: analyzeUsage?.promptTokenCount ?? 0,
      tokensOut: analyzeUsage?.candidatesTokenCount ?? 0,
      durationMs: Date.now() - analyzeStart,
    })
    const summary = result.response.text().trim();

    return {
      success: true,
      summary: summary,
      rowCount: rowCount,
      totalCount: rowCount
    };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('AI Analyze Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to analyze data' });
  }
});
