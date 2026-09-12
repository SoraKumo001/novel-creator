import { PROMPT_TEMPLATES } from "./generated/templates.js";

export interface PromptMetadata {
  category?: string;
  description?: string;
  name: string;
  variables?: string[];
  [key: string]: unknown;
}

export interface PromptTemplate {
  body: string;
  metadata: PromptMetadata;
}

/**
 * プロンプト名からプロンプトテンプレートを取得します。
 */
export function getPromptTemplate(name: string): PromptTemplate {
  const template = PROMPT_TEMPLATES[name];
  if (!template) {
    throw new Error(`Prompt template not found: "${name}"`);
  }
  return template;
}

/**
 * 登録されているすべてのプロンプト名の一覧を取得します。
 */
export function listPromptNames(): string[] {
  return Object.keys(PROMPT_TEMPLATES);
}
