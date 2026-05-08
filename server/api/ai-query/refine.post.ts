import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_REFINE_INSTRUCTION, DEFAULT_REFINE_MODEL, DEFAULT_GENERATE_INSTRUCTION } from '../../utils/constants';

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
  let modelName = DEFAULT_REFINE_MODEL;
  let systemPrompt = DEFAULT_REFINE_INSTRUCTION;


  try {
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const config = settings[0];
    
    const schemaContext = config?.generateSystemInstruction || DEFAULT_GENERATE_INSTRUCTION;

    if (config) {
      modelName = config.refineModel;
      systemPrompt = config.refineSystemPrompt;
    }

    // Add schema context to the system prompt
    let finalSystemPrompt = `${systemPrompt}\n\nนี่คือข้อมูลโครงสร้างฐานข้อมูล (Schema Context) เพื่อใช้ประกอบการขัดเกลาคำถาม:\n${schemaContext}`;
    
    // Force the AI to ignore the JSON output rule from the schema context
    finalSystemPrompt += `\n\nCRITICAL OVERRIDE FOR OUTPUT FORMAT:
IGNORE any instruction above that asks for JSON output.
You MUST output ONLY the plain text refined question.
NO JSON, NO Markdown code blocks, NO explanations. Just the final sentence.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: finalSystemPrompt
    });

    const result = await model.generateContent(prompt as string);

    const refinedText = result.response.text().trim();

    return {
      success: true,
      refinedText
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
