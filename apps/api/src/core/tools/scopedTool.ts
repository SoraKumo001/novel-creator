import { tool } from 'ai';
import type { z } from 'zod';

/**
 * 小説スコープが未解決のときに全ツール共通で返すエラーメッセージ。
 */
export const NOVEL_NOT_SPECIFIED_ERROR = '対象の小説が指定されていません。';

/**
 * AI SDK v7 の Tool 型は inputSchema のみを定義しており、v4 互換の parameters プロパティは
 * 型上存在しない。本プロジェクトのツールは従来どおり parameters を渡す形で定義されており
 * （実行時の tool() は同一オブジェクトを返す透過関数のため、LLM へ渡るツール定義は現状維持）、
 * この型の不一致を吸収するためにこの1箇所のみキャストを許容する。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defineTool = tool as any;

interface ScopedToolConfig<TSchema extends z.ZodType, TResult> {
  /** LLM に渡るツールの説明 */
  description: string;
  /** LLM に渡るツールの入力スキーマ */
  parameters: TSchema;
  /** 実行対象の小説IDを解決する。null を返した場合は { error: NOVEL_NOT_SPECIFIED_ERROR } を返す */
  resolve: (params: z.input<TSchema>) => string | null;
  /** run が例外を投げた場合に { error } として返すメッセージ */
  errorMessage: string;
  /** ツール本体。解決済み小説IDとパラメータを受け取る */
  run: (novelId: string, params: z.input<TSchema>) => TResult | Promise<TResult>;
}

/**
 * resolveNovelId → null チェック → try/catch の定型を抽象化したツール定義ヘルパ。
 * description / parameters / execute の戻り値形状は手書き実装と完全に同一になる。
 */
export function scopedTool<TSchema extends z.ZodType, TResult>(
  config: ScopedToolConfig<TSchema, TResult>,
): {
  description: string;
  parameters: TSchema;
  execute: (params: z.input<TSchema>) => Promise<TResult | { error: string }>;
} {
  return defineTool({
    description: config.description,
    parameters: config.parameters,
    execute: async (params: z.input<TSchema>) => {
      const novelId = config.resolve(params);
      if (!novelId) {
        return { error: NOVEL_NOT_SPECIFIED_ERROR };
      }
      try {
        return await config.run(novelId, params);
      } catch {
        return { error: config.errorMessage };
      }
    },
  });
}
