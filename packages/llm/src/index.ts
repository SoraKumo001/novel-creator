// Phase 1B: LLM ラッパー
export { createLLMProvider, createEmbeddingProvider } from './provider.js';
export {
  generateText,
  streamText,
  streamTextResult,
  generateJSON,
  generateEmbedding,
} from './generate.js';
export {
  plotGeneration,
  chapterSummary,
  sectionSummary,
  contentGeneration,
  extractTimeline,
  extractSettings,
  editCharacter,
  editSetting,
  createSettingDraft,
  editSettingSection,
  editCharacterSection,
  editSettingDocument,
  editCharacterDocument,
  creativeChatSystemPrompt,
  type CreativeChatContext,
  extractChatEntities,
  proofreadPrompt,
  type ProofreadContext,
} from './prompts/index.js';
