import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_INSTRUCTION
} from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sessionId, queryText, userMessage, messages } = body;

  if (!userMessage || !sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sessionId or userMessage' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const db = await useDb();

    const settingsRows = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const settings = settingsRows[0] || {
      chatModel: DEFAULT_CHAT_MODEL,
      chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION
    };

    // อ่านข้อมูลจาก snapshot ที่ init ไว้แล้ว
    const storage = useStorage('snapshots');
    const csv: any = await storage.getItem(`chat-direct-${sessionId}.csv`);

    if (!csv) {
      throw createError({ statusCode: 404, statusMessage: 'Session หมดอายุหรือไม่พบข้อมูล กรุณาเปิด Modal ใหม่อีกครั้ง' });
    }

    const lines = csv.split('\n').filter((l: string) => l.trim() !== '');
    const columns = lines[0] ? lines[0].split(',') : [];
    const rows = lines.slice(1).map((line: string) => {
      const values = line.split(',');
      const obj: any = {};
      columns.forEach((col: string, index: number) => {
        obj[col.trim()] = values[index] ? values[index].trim() : '-';
      });
      return obj;
    });

    const totalCount = rows.length;

    const dataContext = rows.length === 0
      ? 'ไม่พบข้อมูล'
      : [
          `คอลัมน์: ${columns.join(', ')}`,
          `จำนวนแถวทั้งหมด: ${totalCount} แถว`,
          '',
          rows.map((row: any, i: number) =>
            `[${i + 1}] ${columns.map((col: string) => `${col}: ${row[col] ?? '-'}`).join(' | ')}`
          ).join('\n')
        ].join('\n');

    const chatHistory = (messages || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: settings.chatModel || DEFAULT_CHAT_MODEL,
      systemInstruction: `${settings.chatSystemInstruction}

**สำคัญมาก**: หากผู้ใช้ถามเรื่องสถิติ สัดส่วน ขอดูเป็นกราฟ หรือคุณมองว่าอธิบายด้วยกราฟจะเข้าใจง่ายกว่า ให้คุณสร้างกราฟโดยใช้รูปแบบ JSON block นี้เท่านั้น:

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

ประเภทที่ใช้ได้: bar, line, area, pie, donut เท่านั้น ห้ามใช้รูปแบบ Mermaid หรือรูปแบบอื่นใด

ข้อมูลที่คุณมี (คำขอ: "${queryText || ''}"):
---
${dataContext}
---`
    });

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text().trim();

    return {
      success: true,
      reply,
      rowCount: totalCount
    };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('AI Chat Direct Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Chat failed' });
  }
});
