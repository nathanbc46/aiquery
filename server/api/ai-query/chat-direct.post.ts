import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_INSTRUCTION
} from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { sql, queryText, previewData, userMessage, messages } = body;

  if (!userMessage) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userMessage' });
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

    // สร้าง context จาก previewData ที่ส่งมาโดยตรง
    const rows: any[] = Array.isArray(previewData) ? previewData : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const totalCount = rows.length;

    const dataContext = rows.length === 0
      ? 'ไม่พบข้อมูล'
      : [
          `คอลัมน์: ${columns.join(', ')}`,
          `จำนวนแถวใน Preview: ${totalCount} แถว`,
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
