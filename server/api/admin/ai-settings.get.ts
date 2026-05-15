import { useDb } from '../../utils/db';
import { aiSettings } from '../../utils/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_GENERATE_INSTRUCTION } from '../../utils/constants';
import { 
  DEFAULT_MAX_RESULTS_LIMIT,
  DEFAULT_ANALYZE_MODEL,
  DEFAULT_ANALYZE_INSTRUCTION,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_INSTRUCTION,
  DEFAULT_REFINE_MODEL,
  DEFAULT_REFINE_INSTRUCTION,
  DEFAULT_GENERATE_MODEL,
  DEFAULT_OPTIMIZE_MODEL
} from '../../utils/constants';

export default defineEventHandler(async (event) => {
  const db = await useDb();

  try {
    const results = await db.select().from(aiSettings).where(eq(aiSettings.id, 'global')).limit(1);
    
    if (results.length > 0) {
      return { success: true, settings: results[0] };
    }

    // Default Values if not set
    const defaultSettings = {
      id: 'global',
      refineModel: DEFAULT_REFINE_MODEL,
      refineSystemPrompt: DEFAULT_REFINE_INSTRUCTION,
      generateModel: DEFAULT_GENERATE_MODEL,
      generateSystemInstruction: DEFAULT_GENERATE_INSTRUCTION,

      analyzeModel: DEFAULT_ANALYZE_MODEL,
      analyzeSystemInstruction: DEFAULT_ANALYZE_INSTRUCTION,
      chatModel: DEFAULT_CHAT_MODEL,
      chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION,
      optimizeModel: DEFAULT_OPTIMIZE_MODEL,
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT
    };

    return { success: true, settings: defaultSettings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
