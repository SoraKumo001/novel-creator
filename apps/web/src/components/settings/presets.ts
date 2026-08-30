export interface LLMPreset {
  label: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl?: string;
}

export const LLM_PRESETS: LLMPreset[] = [
  { label: 'GPT-4o', name: 'OpenAI GPT-4o', provider: 'openai', modelId: 'gpt-4o' },
  { label: 'GPT-4o-mini', name: 'OpenAI GPT-4o-mini', provider: 'openai', modelId: 'gpt-4o-mini' },
  {
    label: 'Claude 3.7 Sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
  },
  {
    label: 'Claude 3.5 Haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
  },
  {
    label: 'Gemini 2.5 Pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
  },
  {
    label: 'Gemini 2.5 Flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
  },
  {
    label: 'Ollama (ローカル)',
    name: 'Ollama ローカル',
    provider: 'ollama',
    modelId: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
  },
  {
    label: 'OpenRouter (カスタム)',
    name: 'OpenRouter',
    provider: 'custom_openai',
    modelId: 'deepseek/deepseek-r1',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
];

export interface EmbeddingPreset {
  label: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  dimensions: number;
  baseUrl?: string;
}

export const EMBEDDING_PRESETS: EmbeddingPreset[] = [
  {
    label: 'OpenAI 3-Small (1536次元)',
    name: 'OpenAI text-embedding-3-small',
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    dimensions: 1536,
  },
  {
    label: 'OpenAI 3-Large (3072次元)',
    name: 'OpenAI text-embedding-3-large',
    provider: 'openai',
    modelId: 'text-embedding-3-large',
    dimensions: 3072,
  },
  {
    label: 'Google Gemini (768次元)',
    name: 'Google gemini-embedding-001 (768d)',
    provider: 'google',
    modelId: 'gemini-embedding-001',
    dimensions: 768,
  },
  {
    label: 'Google Gemini (1536次元)',
    name: 'Google gemini-embedding-001 (1536d)',
    provider: 'google',
    modelId: 'gemini-embedding-001',
    dimensions: 1536,
  },
  {
    label: 'Ollama nomic-embed-text (768次元)',
    name: 'Ollama nomic-embed-text',
    provider: 'ollama',
    modelId: 'nomic-embed-text',
    dimensions: 768,
    baseUrl: 'http://localhost:11434/v1',
  },
  {
    label: 'Ollama bge-m3 (1024次元)',
    name: 'Ollama bge-m3',
    provider: 'ollama',
    modelId: 'bge-m3',
    dimensions: 1024,
    baseUrl: 'http://localhost:11434/v1',
  },
];
