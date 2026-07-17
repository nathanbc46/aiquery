import { GoogleGenerativeAI } from '@google/generative-ai';
import { createEventStream } from 'h3';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';
import { DEFAULT_REFINE_MODEL, DEFAULT_GENERATE_INSTRUCTION } from '../../utils/constants';
import { dispatchTool, TOOL_DECLARATIONS } from '../../utils/schemaTools';
import { logTokenUsage } from '../../utils/tokenLogger';

// ไม่รวม sample_data สำหรับ fix context
const FIX_TOOL_DECLARATIONS = TOOL_DECLARATIONS.filter(t => t.name !== 'sample_data')

function extractTableNames(sqlText: string): string[] {
  const tables: string[] = []
  const regex = /(?:FROM|JOIN)\s+([`"]?[a-zA-Z_][a-zA-Z0-9_]*[`"]?)/gi
  let match
  while ((match = regex.exec(sqlText)) !== null) {
    const tbl = match[1].replace(/[`"]/g, '')
    if (!tables.includes(tbl)) tables.push(tbl)
  }
  return tables
}

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { sql, error, schemaContext } = body;

  if (!sql || !error) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sql or error' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured' });
  }

  const eventStream = createEventStream(event);

  ;(async () => {
    const send = async (data: object) => { await eventStream.push(JSON.stringify(data)); }

    try {
      const db = await useDb();
      const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
      const config = settings[0];
      const modelName = config?.refineModel || DEFAULT_REFINE_MODEL;

      // Real-time describe ตารางใน SQL ก่อน — stream status ด้วย
      const sqlTables = extractTableNames(sql);
      const liveSchemas: string[] = [];
      for (const tbl of sqlTables) {
        await send({ type: 'tool_start', tool: 'describe_table', args: { table_name: tbl } });
        try {
          const cols = await dispatchTool('describe_table', { table_name: tbl }, session.role ?? 'user') as any[];
          if (Array.isArray(cols) && cols.length > 0) {
            if (cols[0]?.column === 'error') {
              liveSchemas.push(`### ${tbl}\n⚠️ ตารางนี้ไม่มีอยู่ใน DB: ${cols[0].comment}\nให้ใช้ list_tables หรือ search_columns เพื่อหาชื่อตารางที่ถูกต้อง`);
            } else {
              const colLines = cols.map((c: any) =>
                `  - ${c.column}: ${c.type}${c.key === 'PRI' ? ' (PK)' : ''}${c.nullable === 'NO' ? ' NOT NULL' : ''}${c.comment ? ` -- ${c.comment}` : ''}`
              );
              liveSchemas.push(`### ${tbl}\n${colLines.join('\n')}`);
            }
          }
        } catch { /* ข้าม */ }
        await send({ type: 'tool_done', tool: 'describe_table' });
      }

      const liveSchemaText = liveSchemas.length > 0
        ? `## โครงสร้างตารางที่ใช้ใน SQL (ข้อมูลจริงจาก DB)\n\n${liveSchemas.join('\n\n')}`
        : '';
      const staticSchema = config?.generateSystemInstruction || DEFAULT_GENERATE_INSTRUCTION;
      const initialSchema = liveSchemaText || (schemaContext?.trim()) || staticSchema;

      const systemInstruction = `คุณคือผู้เชี่ยวชาญ MySQL และ Vtiger CRM ที่ช่วยแก้ไข SQL Error
⚠️ กฎสำคัญ: อ้างอิงเฉพาะคอลัมน์ที่มีจริงใน Schema Context เท่านั้น ห้ามเดาชื่อคอลัมน์
หากข้อมูลที่ต้องการไม่มีในตารางปัจจุบัน ให้ใช้ tools ค้นหาตารางอื่นที่เกี่ยวข้อง
แล้วเสนอ JOIN ที่ถูกต้องจาก DB จริง

นี่คือ Schema เริ่มต้น:
${initialSchema}

กฎการตอบ (JSON เท่านั้น ไม่มี Markdown):
{ "cause": "สาเหตุภาษาไทย", "fix": "วิธีแก้ภาษาไทย", "fixedSql": "SQL ที่แก้แล้ว หรือ null" }
- fixedSql ต้องเป็น SELECT/WITH เท่านั้น`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const chat = model.startChat({
        tools: [{ functionDeclarations: FIX_TOOL_DECLARATIONS }]
      });

      const prompt = `SQL ที่รัน:\n${sql}\n\nError ที่พบล่าสุด:\n${error}\n\n` +
        `โปรดตรวจสอบ SQL ทั้งหมดเทียบกับ Schema ด้านบน และค้นหาตารางเพิ่มเติมถ้าจำเป็น ` +
        `แล้วแก้ไขทุกปัญหาพร้อมกันในครั้งเดียว ส่งคืนเป็น JSON`;

      const fixSqlStart = Date.now()
      let chatResult = await chat.sendMessage(prompt);

      // Mini agentic loop — AI อาจค้นหา schema เพิ่มเติม (max 5 รอบ)
      for (let i = 0; i < 5; i++) {
        const parts = chatResult.response.candidates?.[0]?.content?.parts ?? [];
        const fnCalls = parts.filter((p: any) => p.functionCall);
        if (!fnCalls.length) break;

        const toolResponses: any[] = [];
        for (const part of fnCalls) {
          const { name, args } = (part as any).functionCall;
          await send({ type: 'tool_start', tool: name, args: args ?? {} });
          try {
            const toolResult = await dispatchTool(name, args ?? {}, session.role ?? 'user');
            toolResponses.push({ functionResponse: { name, response: { result: toolResult } } });
          } catch {
            toolResponses.push({ functionResponse: { name, response: { result: { error: 'Tool unavailable' } } } });
          }
          await send({ type: 'tool_done', tool: name });
        }
        chatResult = await chat.sendMessage(toolResponses);
      }

      // บังคับให้ตอบเป็น text ถ้า AI ยังมี pending function calls
      {
        const finalParts = chatResult.response.candidates?.[0]?.content?.parts ?? [];
        const stillHasFnCalls = finalParts.some((p: any) => p.functionCall);
        let rawText = '';
        try { rawText = chatResult.response.text(); } catch { /* force ด้านล่าง */ }
        if (stillHasFnCalls || !rawText.trim()) {
          chatResult = await chat.sendMessage(
            'ตอบเป็น JSON เท่านั้น: { "cause": "...", "fix": "...", "fixedSql": "..." }'
          );
        }
      }

      const fixSqlUsage = chatResult.response.usageMetadata
      logTokenUsage({
        endpoint: 'fix-sql',
        modelUsed: modelName,
        userId: session.userId,
        tokensIn: fixSqlUsage?.promptTokenCount ?? 0,
        tokensOut: fixSqlUsage?.candidatesTokenCount ?? 0,
        durationMs: Date.now() - fixSqlStart,
      })

      let raw: string;
      try {
        raw = chatResult.response.text().trim();
      } catch {
        await send({ type: 'error', message: 'AI ไม่สามารถสร้างคำตอบได้ กรุณาลองใหม่อีกครั้ง' });
        await eventStream.close();
        return;
      }
      let parsed: { cause: string; fix: string; fixedSql: string | null };
      try {
        const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        await send({ type: 'error', message: 'AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง' });
        await eventStream.close();
        return;
      }

      await send({
        type: 'done',
        suggestion: {
          cause: parsed.cause || '',
          fix: parsed.fix || '',
          fixedSql: parsed.fixedSql || null
        }
      });

    } catch (e: any) {
      console.error('Fix SQL Error:', e);
      await send({ type: 'error', message: e.message || 'Fix failed' });
    }

    await eventStream.close();
  })();

  return eventStream.send();
});
