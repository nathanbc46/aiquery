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
  const { sessionId, queryText, userMessage, messages, modelOverride } = body;

  // Whitelist model ที่อนุญาต (ป้องกัน model injection)
  const ALLOWED_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.1-flash-lite-preview'];

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

    // อ่านข้อมูลจาก snapshot ที่ init ไว้แล้ว (NDJSON format ใหม่)
    const storage = useStorage('snapshots');

    // ลอง NDJSON ก่อน (format ใหม่) — fallback ไป CSV (format เก่า)
    // ใช้ generic <string> เพื่อให้ unstorage คืน string | null แทน StorageValue
    const ndjson = await storage.getItem<string>(`chat-direct-${sessionId}.ndjson`);
    const csv = !ndjson ? await storage.getItem<string>(`chat-direct-${sessionId}.csv`) : null;

    if (!ndjson && !csv) {
      throw createError({ statusCode: 404, statusMessage: 'Session หมดอายุหรือไม่พบข้อมูล กรุณาเปิด Modal ใหม่อีกครั้ง' });
    }

    let rows: Record<string, string>[];
    let columns: string[];

    if (ndjson) {
      // --- Parse NDJSON (JSON Lines) ---
      // แต่ละบรรทัดคือ JSON object 1 ตัว ปลอดภัยจากปัญหา delimiter ทุกชนิด
      rows = ndjson
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          try {
            return JSON.parse(line) as Record<string, string>;
          } catch {
            return {} as Record<string, string>;
          }
        })
        .filter(obj => Object.keys(obj).length > 0);
      // เก็บ rows[0] ลงตัวแปรก่อน เพื่อให้ TypeScript narrow type ได้ (rows[0] อาจเป็น undefined ตาม type system)
      const firstRow = rows[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    } else {
      // --- Fallback: Parse CSV (format เก่า) ด้วย RFC 4180 parser ---
      // รองรับ quoted fields ที่มี comma หรือ newline ข้างใน
      const parseQuotedCsv = (text: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let field = '';
        let inQuotes = false;
        let i = 0;
        while (i < text.length) {
          const ch = text[i];
          if (inQuotes) {
            if (ch === '"') {
              if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
              inQuotes = false;
            } else {
              field += ch;
            }
          } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field.trim()); field = ''; }
            else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
              row.push(field.trim()); field = '';
              result.push(row); row = [];
              if (ch === '\r') i++;
            } else { field += ch; }
          }
          i++;
        }
        if (field || row.length > 0) { row.push(field.trim()); result.push(row); }
        return result;
      };

      const parsed = parseQuotedCsv(csv!);
      columns = parsed[0] ?? [];
      rows = parsed.slice(1).map(vals => {
        const obj: Record<string, string> = {};
        columns.forEach((col, idx) => { obj[col] = vals[idx] ?? '-'; });
        return obj;
      });
    }

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
    // ใช้ modelOverride ถ้า user เลือกและอยู่ใน whitelist — ไม่งั้นใช้ค่าจาก admin settings
    const resolvedModel = (modelOverride && ALLOWED_MODELS.includes(modelOverride))
      ? modelOverride
      : (settings.chatModel || DEFAULT_CHAT_MODEL);
    const model = genAI.getGenerativeModel({
      model: resolvedModel,
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
