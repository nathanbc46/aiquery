import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_GENERATE_INSTRUCTION, DEFAULT_MAX_RESULTS_LIMIT } from '../../utils/constants';
import { useDb } from '../../utils/db';
import { sql, eq } from 'drizzle-orm';
import { aiSettings } from '../../utils/schema';
import { getAuthSession } from '../../utils/auth';
import { pruneSchema } from '../../utils/schemaPruning';

export default defineEventHandler(async (event) => {
  // 1. ตรวจสอบสิทธิ์
  const session = await getAuthSession(event);
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const body = await readBody(event);
  const prompt = body.prompt;
  const contextData = body.contextData; // ข้อมูลจากไฟล์ที่อัปโหลด
  const useHybridSchema = body.useHybridSchema ?? false;
  const isDebugMode = body.isDebugMode ?? false;

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
    
    let modelName = 'gemini-1.5-flash'; // Fallback
    let maxLimit = DEFAULT_MAX_RESULTS_LIMIT;
    let systemInstruction = DEFAULT_GENERATE_INSTRUCTION;
    
    try {
      const settings = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
      const config = settings[0];
      if (config) {
        modelName = config.generateModel;
        systemInstruction = config.generateSystemInstruction || DEFAULT_GENERATE_INSTRUCTION;
        maxLimit = config.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT;
      }
    } catch (sErr) {
      console.warn('Settings fetch failed, using defaults', sErr);
    }

    // Inject the dynamic limit into the system instruction
    systemInstruction = systemInstruction.replace('{MAX_LIMIT}', maxLimit.toString());

    // --- HYBRID SCHEMA SELECTION ---
    let debugInfo = null;
    if (useHybridSchema) {
      const pruningResult = pruneSchema(systemInstruction, prompt);
      systemInstruction = pruningResult.finalInstruction;
      if (isDebugMode) {
        debugInfo = {
          isHybrid: true,
          selectedTables: pruningResult.selectedTables,
          reductionPercentage: pruningResult.reductionPercentage
        };
      }
    } else if (isDebugMode) {
      // If not hybrid but debug is on, we still want to show what was sent (everything)
      debugInfo = {
        isHybrid: false,
        selectedTables: ['ALL TABLES (Full Context)'],
        reductionPercentage: 0
      };
    }

    // Force explanation format regardless of DB settings
    systemInstruction += `\n\nCRITICAL OUTPUT FORMAT OVERRIDE: 
    For the "explanation" field in your JSON response, you MUST format it as a Markdown bulleted list (-). 
    Use **bold** text to highlight important keywords, table names, field names, or specific conditions. 
    Make the explanation concise and easy to read for a non-technical manager.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction
    });

    const DATA_CONTEXT_LIMIT = 200;

    let finalPrompt = prompt;
    if (Array.isArray(contextData) && contextData.length > 0) {
      // จำกัดข้อมูลที่ส่งให้ AI เพื่อไม่ให้เกิน Token Limit
      const dataSample = contextData.slice(0, DATA_CONTEXT_LIMIT);
      const hasMore = contextData.length > DATA_CONTEXT_LIMIT;
      
      finalPrompt = `[ข้อมูลประกอบจากไฟล์ที่ผู้ใช้อัปโหลด]\n`;
      finalPrompt += `จำนวนข้อมูลทั้งหมดในไฟล์: ${contextData.length} แถว\n`;
      finalPrompt += `ตัวอย่างข้อมูล (${dataSample.length} แถวแรก):\n${JSON.stringify(dataSample, null, 2)}\n`;
      if (hasMore) {
        finalPrompt += `... (มีข้อมูลอีก ${contextData.length - DATA_CONTEXT_LIMIT} แถวที่ไม่ได้แสดงในตัวอย่างนี้แต่คุณสามารถสรุป Logic จากตัวอย่างได้)\n`;
      }
      finalPrompt += `\n[คำถามของผู้ใช้]\n${prompt}\n\n`;
      finalPrompt += `คำแนะนำสำหรับ AI:\n`;
      finalPrompt += `- หากผู้ใช้ต้องการให้ Match ข้อมูลจากไฟล์กับ Database ให้คุณดึงค่า Key ที่สำคัญ (เช่น ชื่อ, อีเมล, หรือ ID) จากไฟล์มาสร้างเป็นเงื่อนไข IN (...) ใน SQL\n`;
      finalPrompt += `- หากข้อมูลในไฟล์มีจำนวนมาก ให้ใช้เฉพาะตัวอย่างที่สำคัญในการสร้าง Query และอธิบายให้ผู้ใช้ทราบว่าคุณใช้ข้อมูลจากไฟล์มาช่วย\n`;
      finalPrompt += `- ให้ความสำคัญกับการ Join ตารางใน Vtiger ให้ถูกต้องตาม Schema`;
    }

    const result = await model.generateContent(finalPrompt);
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

    // --- Hard Limit Enforcement ---
    let finalSql = jsonResult.sql.trim().replace(/;$/, '');
    const limitMatch = finalSql.match(/LIMIT\s+(\d+)/i);
    let limitOverridden = false;
    
    if (limitMatch) {
      const userLimit = parseInt(limitMatch[1]);
      if (userLimit > maxLimit) {
        // Override with system max limit
        finalSql = finalSql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxLimit}`);
        limitOverridden = true;
      }
    } else {
      // No limit found, append system max limit
      finalSql += ` LIMIT ${maxLimit}`;
    }
    jsonResult.sql = finalSql;

    // Step 2: Get Preview Data (Limit based on role)
    const generateOnly = body.generateOnly ?? false;
    const isAdminOrManager = session.role === 'admin' || session.role === 'manager';
    const previewLimit = generateOnly ? 1 : (isAdminOrManager ? 50 : 10);
    const previewSql = jsonResult.sql.replace(/LIMIT\s+\d+$/i, '').replace(/;$/, '') + ` LIMIT ${previewLimit}`;
    
    let previewData: any[] = [];
    let previewCount = 0;

    let dbError: string | null = null;
    try {
      if (!generateOnly) {
        // Get actual count first
        const countSql = `SELECT COUNT(*) as total FROM (${jsonResult.sql.replace(/;$/, '')}) as subquery`;
        const [countRes]: any = await db.execute(sql.raw(countSql));
        previewCount = countRes[0]?.total || 0;
      }

      // Get preview records (Even for generateOnly, to check syntax)
      const [rows]: any = await db.execute(sql.raw(previewSql));

      if (!generateOnly) {
        previewData = (rows as any[]).map(row => {
          if (isAdminOrManager) return row; // Admin/Manager ดูข้อมูลดิบได้เลย ไม่ต้อง Mask
          
          const maskedRow: any = {};
          for (const key in row) {
            maskedRow[key] = maskSensitiveData(row[key]);
          }
          return maskedRow;
        });
      }
    } catch (err: any) {
      console.error('Preview Execution Error:', err);
      dbError = err.message || 'Database execution failed';
    }

    return {
      success: true,
      status: generateOnly && !dbError ? 'draft' : (dbError ? 'error' : 'success'),
      sql: jsonResult.sql,
      explanation: jsonResult.explanation,
      previewCount: previewCount,
      maxResultsLimit: maxLimit,
      previewData: previewData,
      dbError: dbError,
      limitOverridden: limitOverridden,
      debug: debugInfo
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
