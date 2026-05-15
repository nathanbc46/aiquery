import { GoogleGenerativeAI } from '@google/generative-ai';
import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_OPTIMIZE_MODEL } from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { sql: originalSql, explanation: originalExplanation } = body;

  if (!originalSql) {
    return { success: false, error: 'กรุณาระบุคำสั่ง SQL ที่ต้องการปรับปรุง' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน .env' };
  }

  const db = await useDb();
  
  // Default to a capable pro model for DBA tasks
  let modelName = DEFAULT_OPTIMIZE_MODEL; 

  try {
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    const config = settings[0];
    if (config && config.optimizeModel) {
       modelName = config.optimizeModel;
    } else if (config && config.generateModel) {
       if (config.generateModel.includes('pro')) {
          modelName = config.generateModel;
       }
    }
  } catch (e) {
    console.warn('Could not fetch settings', e);
  }

  try {
    const optimizeSystemInstruction = `You are an expert MySQL database administrator specializing in Vtiger CRM.
Your task is to take an existing SQL query and optimize it for maximum performance, efficiency, and safety.
Apply these critical optimization rules:
1. Prefer EXISTS / NOT EXISTS over LEFT JOIN ... WHERE ... IS NULL (Anti-Join) when checking for existence. EXISTS is significantly faster in MySQL/MariaDB as it stops execution early.
2. Avoid using functions like REPLACE(), TRIM(), or LOWER() on JOIN conditions, as it breaks indexes. If string manipulation is absolutely necessary for joining, prefer using EXISTS instead of INNER JOIN.
3. Replace subqueries with JOINs if more efficient, avoid SELECT *, and optimize WHERE clauses.

CRITICAL: You MUST return ONLY a JSON object with this exact structure:
{
  "sql": "the highly optimized SQL query",
  "explanation": "A concise bulleted list in Thai explaining EXACTLY what you optimized and why it is faster."
}
DO NOT output any markdown blocks, just the JSON string.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const optimizerModel = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: optimizeSystemInstruction
    });

    const optimizePromptStr = `Please optimize this SQL query:
${originalSql}

Original logic explanation (for your context):
${originalExplanation || ''}`;

    const optimizeResult = await optimizerModel.generateContent(optimizePromptStr);
    let optimizeResponseText = optimizeResult.response.text().trim();
    
    if (optimizeResponseText.startsWith('\`\`\`json')) {
      optimizeResponseText = optimizeResponseText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (optimizeResponseText.startsWith('\`\`\`')) {
      optimizeResponseText = optimizeResponseText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }

    const optimizeJson = JSON.parse(optimizeResponseText);

    return {
      success: true,
      optimizedSql: optimizeJson.sql,
      optimizationExplanation: optimizeJson.explanation,
      modelUsed: modelName
    };
  } catch (error: any) {
    console.error('Optimization API Error:', error);
    return { success: false, error: error.message || 'ไม่สามารถปรับปรุง SQL ได้' };
  }
});
