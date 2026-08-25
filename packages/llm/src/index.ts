// Phase 1B: LLM ラッパー
export { createLLMProvider, createEmbeddingProvider } from './provider.js';
export { generateText, streamText, generateJSON, generateEmbedding } from './generate.js';
export {
  plotGeneration,
  chapterSummary,
  sectionSummary,
  contentGeneration,
  extractTimeline,
  extractSettings,
  editCharacter,
  editSetting,
} from './prompts/index.js';
