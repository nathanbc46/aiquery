import { useDb } from '../utils/db';
import { aiSettings } from '../utils/schema';
import { DEFAULT_MAX_RESULTS_LIMIT, DEFAULT_CHAT_MODEL, SUGGESTED_QUERIES } from '../utils/constants';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    const settings = await db.select({
      maxResultsLimit: aiSettings.maxResultsLimit,
      chatModel: aiSettings.chatModel,
      useHybridSchema: aiSettings.useHybridSchema,
      isDebugMode: aiSettings.isDebugMode
    }).from(aiSettings).limit(1);

    return {
      maxResultsLimit: settings[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT,
      chatModel: settings[0]?.chatModel || DEFAULT_CHAT_MODEL,
      useHybridSchema: settings[0]?.useHybridSchema ?? false,
      isDebugMode: settings[0]?.isDebugMode ?? false,
      suggestions: SUGGESTED_QUERIES
    };
  } catch (error) {
    return {
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT,
      chatModel: DEFAULT_CHAT_MODEL,
      suggestions: SUGGESTED_QUERIES
    };
  }
});
