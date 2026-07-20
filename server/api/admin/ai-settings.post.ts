import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_AGENTIC_MODEL, DEFAULT_AGENTIC_MAX_ITERATIONS } from '../../utils/constants';
import { requireAuthRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthRole(event, ['admin']);

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
    isDebugMode,
    customHints,
    agenticModel,
    generateMode,
    agenticMaxIterations
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
          isDebugMode,
          customHints: customHints ?? null,
          agenticModel: agenticModel ?? DEFAULT_AGENTIC_MODEL,
          generateMode: generateMode ?? 'agentic',
          agenticMaxIterations: agenticMaxIterations ?? DEFAULT_AGENTIC_MAX_ITERATIONS
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
        isDebugMode,
        customHints: customHints ?? null,
        agenticModel: agenticModel ?? DEFAULT_AGENTIC_MODEL,
        generateMode: generateMode ?? 'agentic',
        agenticMaxIterations: agenticMaxIterations ?? DEFAULT_AGENTIC_MAX_ITERATIONS
      });
    }

    return { success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
