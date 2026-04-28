import { GoogleGenerativeAI } from '@google/generative-ai';
import { VTIGER_SCHEMA } from '../../utils/vtigerSchema';
import { useDb } from '../../utils/db';
import { sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
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
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We use gemini-1.5-pro or gemini-1.5-flash. Using flash for faster SQL generation
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: VTIGER_SCHEMA
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
      // Use regex with word boundaries \b to avoid matching "DELETED" column
      const regex = new RegExp(`\\b${keyword}\\b`);
      if (regex.test(sqlUpper)) {
        throw new Error(`Security Violation: The generated SQL contains forbidden keyword '${keyword}'.`);
      }
    }

    // Connect to actual database and get real count
    let previewCount = 0;
    try {
      const db = await useDb();
      // Wrap the generated SQL inside a COUNT(*) to safely count results without fetching all data
      const countQuery = sql.raw(`SELECT COUNT(*) as total FROM (${jsonResult.sql}) AS subquery`);
      
      const [rows]: any = await db.execute(countQuery);
      if (rows && rows.length > 0) {
        previewCount = rows[0].total || 0;
      }
    } catch (dbError: any) {
      console.error('Database Query Error:', dbError);
      // Throw error if database fails, so the user knows they need to configure DATABASE_URL
      throw new Error(`เชื่อมต่อฐานข้อมูลล้มเหลว หรือ SQL ผิดพลาด: ${dbError.message}`);
    }

    return { 
      success: true, 
      status: 'success',
      sql: jsonResult.sql, 
      explanation: jsonResult.explanation,
      previewCount: previewCount
    };

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate SQL from AI'
    };
  }
});
