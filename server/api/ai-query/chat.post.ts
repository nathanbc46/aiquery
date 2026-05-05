import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiQueryRequests, aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { 
  DEFAULT_CHAT_MODEL, 
  DEFAULT_CHAT_INSTRUCTION, 
  DEFAULT_MAX_RESULTS_LIMIT 
} from '../../utils/constants';



export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { requestId, messages, userMessage } = body;

  if (!requestId || !userMessage) {
    throw createError({ statusCode: 400, statusMessage: 'Missing requestId or userMessage' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const db = await useDb();

    // ดึงข้อมูล Settings จาก DB เสมอเผื่อมีการเปลี่ยน
    const settingsRows = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const settings = settingsRows[0] || {
      chatModel: DEFAULT_CHAT_MODEL,
      chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION,
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT
    };

    // 1. ดึงข้อมูลจาก Snapshot Storage
    const storage = useStorage('snapshots');
    const csv: any = await storage.getItem(`${requestId}.csv`);

    if (!csv) {
      throw createError({ 
        statusCode: 404, 
        statusMessage: 'ไม่พบไฟล์ Snapshot กรุณาติดต่อผู้ดูแลระบบ' 
      });
    }

    // 2. เตรียมข้อมูลสำหรับส่งให้ AI (ดึงจาก CSV)
    const lines = csv.split('\n').filter((l: string) => l.trim() !== '');
    const rowCount = lines.length > 0 ? lines.length - 1 : 0;
    const columns = lines[0] ? lines[0].split(',') : [];
    
    // Parse CSV rows into objects for the existing context logic
    const rows = lines.slice(1).map((line: string) => {
      const values = line.split(',');
      const obj: any = {};
      columns.forEach((col: string, index: number) => {
        obj[col.trim()] = values[index] ? values[index].trim() : '-';
      });
      return obj;
    });

    const totalCount = rowCount;
    const queryText = (await db.select({ queryText: aiQueryRequests.queryText }).from(aiQueryRequests).where(eq(aiQueryRequests.id, requestId)).limit(1))[0]?.queryText || '';

    // 3. เตรียม Data Context (ใช้ข้อมูลตามขีดจำกัดที่ตั้งไว้)
    const sampleRows = rows;
    const dataContext = rows.length === 0
      ? 'ไม่พบข้อมูล'
      : [
          `คอลัมน์: ${columns.join(', ')}`,
          `จำนวนแถวทั้งหมด: ${totalCount} แถว (Context: ${sampleRows.length} แถวแรก)`,
          '',
          sampleRows.map((row: any, i: number) =>
            `[${i + 1}] ${columns.map((col: string) => `${col}: ${row[col] ?? '-'}`).join(' | ')}`
          ).join('\n')
        ].join('\n');

    // 3. เตรียม Chat History สำหรับ Gemini (format: { role, parts })
    const chatHistory = (messages || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // 4. เรียก Gemini ด้วย Chat Session
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: settings.chatModel || 'gemini-2.0-flash',
      systemInstruction: `${settings.chatSystemInstruction}

**สำคัญมาก**: หากผู้ใช้ถามเรื่องสถิติ สัดส่วน ขอดูเป็นกราฟ หรือคุณมองว่าอธิบายด้วยกราฟจะเข้าใจง่ายกว่า ให้คุณสร้างกราฟโดยใช้ Markdown ของ \`\`\`mermaid แทรกมาในการตอบของคุณเสมอ

**กฎการเขียน Mermaid (v11+ compatible)**:
1. สำหรับกราฟ Pie: ต้องใส่เครื่องหมายคำพูดครอบ title และชื่อ label เสมอ เช่น \`pie title "ยอดขาย" "สินค้า A" : 100\`
2. สำหรับ Flowchart/Graph: ชื่อ Node ที่มีอักขระพิเศษหรือเว้นวรรค ต้องครอบด้วย " " เสมอ เช่น \`A["ขั้นตอน (1)"] --> B["ขั้นตอน (2)"]\`

ข้อมูลที่คุณมี (คำขอ: "${queryText}"):
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
      rowCount: rows.length,
      totalCount
    };

  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('AI Chat Error:', error);
    throw createError({ statusCode: 500, statusMessage: error.message || 'Chat failed' });
  }
});
