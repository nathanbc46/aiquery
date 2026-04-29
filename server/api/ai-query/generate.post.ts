import { GoogleGenerativeAI } from '@google/generative-ai';
import { VTIGER_SCHEMA } from '../../utils/vtigerSchema';
import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  // 1. ตรวจสอบสิทธิ์
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const prompt = body.prompt;

  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt is required' });
  }

  // Use the API key from environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured in .env' });
  }

  try {
    const db = await useDb();
    
    // Fetch Settings
    const { aiSettings } = await import('../../utils/schema');
    const { eq } = await import('drizzle-orm');
    const { DEFAULT_MAX_RESULTS_LIMIT } = await import('../../utils/constants');
    
    let modelName = 'gemini-1.5-flash'; // Fallback
    let maxLimit = DEFAULT_MAX_RESULTS_LIMIT;
    let systemInstruction = VTIGER_SCHEMA;
    
    try {
      const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
      const config = settings[0];
      if (config) {
        modelName = config.generateModel;
        systemInstruction = config.generateSystemInstruction || VTIGER_SCHEMA;
        maxLimit = config.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;
      }
    } catch (sErr) {
      console.warn('Settings fetch failed, using defaults', sErr);
    }

    // Inject the dynamic limit into the system instruction
    systemInstruction = systemInstruction.replace('{MAX_LIMIT}', maxLimit.toString());

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Clean up Markdown code block formatting if Gemini ignored the instruction
    if (responseText.startsWith('\`\`\`json')) {
      responseText = responseText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (responseText.startsWith('\`\`\`')) {
      responseText = responseText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }

    const jsonResult = JSON.parse(responseText);

    // Handle Clarification Status
    if (jsonResult.status === 'clarification_needed') {
      return {
        success: true,
        status: 'clarification_needed',
        explanation: jsonResult.explanation
      };
    }

    // Basic Security Check (Guardrail)
    const sqlUpper = jsonResult.sql.toUpperCase();
    const forbiddenKeywords = ['UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'INSERT', 'EXEC'];
    
    for (const keyword of forbiddenKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`);
      if (regex.test(sqlUpper)) {
        throw new Error(`Security Violation: The generated SQL contains forbidden keyword '${keyword}'.`);
      }
    }

    // Step 2: Get Preview Data (Limit 10)
    const previewSql = jsonResult.sql.replace(/LIMIT\s+\d+/i, '').replace(/;$/, '') + ' LIMIT 10';
    
    let previewData: any[] = [];
    let previewCount = 0;

    try {
      // Get actual count first
      const countSql = `SELECT COUNT(*) as total FROM (${jsonResult.sql.replace(/;$/, '')}) as subquery`;
      const [countRes]: any = await db.execute(sql.raw(countSql));
      previewCount = countRes[0]?.total || 0;

      // Get preview records
      const [rows]: any = await db.execute(sql.raw(previewSql));
      previewData = (rows as any[]).map(row => {
        const maskedRow: any = {};
        for (const key in row) {
          maskedRow[key] = maskSensitiveData(row[key]);
        }
        return maskedRow;
      });
    } catch (dbError: any) {
      console.error('Preview Execution Error:', dbError);
    }

    return {
      success: true,
      status: 'success',
      sql: jsonResult.sql,
      explanation: jsonResult.explanation,
      previewCount: previewCount,
      maxResultsLimit: maxLimit,
      previewData: previewData
    };

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate SQL'
    });
  }
});

// Helper function to mask sensitive data
function maskSensitiveData(value: any): string {
  if (value === null || value === undefined) return '-';
  const str = String(value);
  if (str.length <= 3) return str + '***';
  // Show first 3 chars, then mask, show last 2 chars if long enough
  if (str.length > 7) {
    return str.substring(0, 3) + '****' + str.substring(str.length - 2);
  }
  return str.substring(0, 3) + '****';
}
