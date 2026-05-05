import { useDb } from '../utils/db';
import { aiSettings } from '../utils/schema';
import { DEFAULT_MAX_RESULTS_LIMIT, SUGGESTED_QUERIES } from '../utils/constants';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    const settings = await db.select({
      maxResultsLimit: aiSettings.maxResultsLimit
    }).from(aiSettings).limit(1);

    return {
      maxResultsLimit: settings[0]?.maxResultsLimit || DEFAULT_MAX_RESULTS_LIMIT,
      suggestions: SUGGESTED_QUERIES
    };
  } catch (error) {
    return {
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT,
      suggestions: SUGGESTED_QUERIES
    };
  }
});
