import { 
  DEFAULT_MAX_RESULTS_LIMIT,
  DEFAULT_ANALYZE_MODEL,
  DEFAULT_ANALYZE_INSTRUCTION,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_INSTRUCTION,
  DEFAULT_REFINE_MODEL,
  DEFAULT_REFINE_INSTRUCTION,
  DEFAULT_GENERATE_MODEL,
  DEFAULT_GENERATE_INSTRUCTION
} from '../../../utils/constants';

export default defineEventHandler(async (event) => {
  return {
    success: true,
    defaults: {
      refineModel: DEFAULT_REFINE_MODEL,
      refineSystemPrompt: DEFAULT_REFINE_INSTRUCTION,
      generateModel: DEFAULT_GENERATE_MODEL,
      generateSystemInstruction: DEFAULT_GENERATE_INSTRUCTION,
      analyzeModel: DEFAULT_ANALYZE_MODEL,
      analyzeSystemInstruction: DEFAULT_ANALYZE_INSTRUCTION,
      chatModel: DEFAULT_CHAT_MODEL,
      chatSystemInstruction: DEFAULT_CHAT_INSTRUCTION,
      maxResultsLimit: DEFAULT_MAX_RESULTS_LIMIT,
      useHybridSchema: false,
      isDebugMode: false
    }
  };
});
