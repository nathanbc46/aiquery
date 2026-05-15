import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = await useDb();
  const body = await readBody(event);

  const {
    refineModel, 
    refineSystemPrompt, 
    generateModel, 
    generateSystemInstruction,
    analyzeModel,
    analyzeSystemInstruction,
    chatModel,
    chatSystemInstruction,
    optimizeModel,
    maxResultsLimit,
    useHybridSchema,
    isDebugMode
  } = body;

  try {
    // Check if exists
    const existing = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);

    if (existing.length > 0) {
      // Update
      await db.update(aiSettings)
        .set({
          refineModel,
          refineSystemPrompt,
          generateModel,
          generateSystemInstruction,
          analyzeModel,
          analyzeSystemInstruction,
          chatModel,
          chatSystemInstruction,
          optimizeModel,
          maxResultsLimit,
          useHybridSchema,
          isDebugMode
        })
        .where(eq(aiSettings.id, 'global'));
    } else {
      // Insert
      await db.insert(aiSettings).values({
        id: 'global',
        refineModel,
        refineSystemPrompt,
        generateModel,
        generateSystemInstruction,
        analyzeModel,
        analyzeSystemInstruction,
        chatModel,
        chatSystemInstruction,
        optimizeModel,
        maxResultsLimit,
        useHybridSchema,
        isDebugMode
      });
    }

    return { success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
