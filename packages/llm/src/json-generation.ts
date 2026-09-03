import type { LanguageModel } from "ai";
import type { ZodError, ZodType } from "zod";
import type { GenerateTextOptions } from "./text-generation.js";
import { generateText } from "./text-generation.js";

/**
 * LLM 出力から ```json ... ``` または ``` ... ``` のコードブロックを除去する。
 */
function stripJSONCodeBlock(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : text;
}

/**
 * LLM 出力から JSON 文字列を抽出する。
 */
function extractJSON(text: string): string {
  const cleaned = stripJSONCodeBlock(text.trim());

  const startIdx = cleaned.search(/[{[]/);
  if (startIdx === -1) {
    return cleaned;
  }
  const startChar = cleaned[startIdx];
  const endChar = startChar === "{" ? "}" : "]";
  const endIdx = cleaned.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx < startIdx) {
    return cleaned;
  }

  return cleaned.slice(startIdx, endIdx + 1);
}

/**
 * generateJSON の呼び出しオプション。
 */
export interface GenerateJSONOptions extends GenerateTextOptions {}

/**
 * zod スキーマのバリデーションに失敗したことを表すエラー。
 */
export class JSONValidationError extends Error {
  readonly zodError: ZodError;

  constructor(message: string, zodError: ZodError) {
    super(message);
    this.name = "JSONValidationError";
    this.zodError = zodError;
  }
}

/** ZodError を修復プロンプトに埋め込める1行サマリーへ変換する。 */
function summarizeZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * AI SDK の generateText を利用して JSON を生成し、パースして返す。
 * schema が渡された場合は zod で検証し、失敗時は修復プロンプトで1回だけ再生成する。
 */
export async function generateJSON<T>(
  model: LanguageModel,
  prompt: string,
  schema?: ZodType<T>,
  options: GenerateJSONOptions = {}
): Promise<T> {
  const generateOnce = async (currentPrompt: string): Promise<T> => {
    const text = await generateText(model, currentPrompt, options);
    const jsonStr = extractJSON(text);
    const value = JSON.parse(jsonStr) as unknown;

    if (schema) {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        throw new JSONValidationError(
          summarizeZodError(parsed.error),
          parsed.error
        );
      }
      return parsed.data;
    }
    return value as T;
  };

  try {
    return await generateOnce(prompt);
  } catch (error) {
    if (!(error instanceof JSONValidationError)) {
      throw error;
    }
    const repairPrompt =
      `${prompt}\n\n` +
      "前回の出力は以下のバリデーションエラーがありました。" +
      "エラーを解消するよう、JSON のみを修正して再出力してください。\n" +
      `エラー: ${error.message}`;
    return generateOnce(repairPrompt);
  }
}
