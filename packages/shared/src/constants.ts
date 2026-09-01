/** 伏線の進行状態（unresolved=未回収, resolved=回収済み, abandoned=断念） */
export const foreshadowingStatuses = [
  "unresolved",
  "resolved",
  "abandoned",
] as const;
export type ForeshadowingStatusValue = (typeof foreshadowingStatuses)[number];

/** LLM プロバイダ種別 */
export const llmProviders = [
  "openai",
  "anthropic",
  "google",
  "ollama",
  "custom_openai",
] as const;
export type LLMProviderType = (typeof llmProviders)[number];
