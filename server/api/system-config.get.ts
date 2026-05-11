import { useDb } from '../utils/db';
import { aiSettings } from '../utils/schema';
import { DEFAULT_MAX_RESULTS_LIMIT, DEFAULT_CHAT_MODEL, SUGGESTED_QUERIES } from '../utils/constants';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    const settings = await db.select({
      maxResultsLimit: aiSettings.maxResultsLimit,
      chatModel: aiSettings.chatModel
    }).from(aiSettings).limit(1);

    return {
      maxResultsLimit: settings[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT,
      // \u0e2a\u0e48\u0e07 chatModel \u0e43\u0e2b\u0e49 frontend \u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e04\u0e48\u0e32 default
      chatModel: settings[0]?.chatModel || DEFAULT_CHAT_MODEL,
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
