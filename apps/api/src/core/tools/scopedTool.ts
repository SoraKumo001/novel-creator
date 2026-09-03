import type { FlexibleSchema } from "ai";
import type { z } from "zod";

/**
 * 小説スコープが未解決のときに全ツール共通で返すエラーメッセージ。
 */
export const NOVEL_NOT_SPECIFIED_ERROR = "対象の小説が指定されていません。";

/** 実行対象の小説IDを解決する。null を返した場合は { error: NOVEL_NOT_SPECIFIED_ERROR } を返す */
export type NovelScopeResolver<TParams> = (
  params: TParams
) => string | null | undefined;

interface CreateToolConfig<TSchema extends z.ZodType, TResult> {
  /** LLM に渡るツールの説明 */
  description: string;
  /** handler が例外を投げた場合に { error } として返すメッセージ */
  errorMessage: string;
  /** ツール本体。解決済み小説IDとパラメータを受け取る */
  handler: (
    novelId: string,
    params: z.output<TSchema>
  ) => TResult | Promise<TResult>;
  /** LLM に渡るツールの入力スキーマ（AI SDK v7 の inputSchema にそのまま渡る） */
  inputSchema: TSchema;
  /** 実行対象の小説IDを解決する */
  scope: NovelScopeResolver<z.output<TSchema>>;
}

/**
 * createTool が返すツール定義の構造型。
 * AI SDK の tool() ヘルパーは受け取ったオブジェクトをそのまま返す透過関数のため、
 * このリテラルは実行時・LLM 送出の両面で tool() 構築物と等価であり、
 * 具体型が定まった呼び出し側では Tool / ToolSet へ代入可能。
 */
export interface ChatTool<TParams, TResult> {
  /** LLM に渡るツールの説明 */
  description: string;
  /** スコープ解決・サニタイズ済みの実行関数 */
  execute: (params: TParams) => Promise<TResult | { error: string }>;
  /** LLM に渡るツールの入力スキーマ（AI SDK v7 の inputSchema 形式） */
  inputSchema: FlexibleSchema<TParams>;
}

/**
 * novelId スコープ解決 → null チェック → try/catch の定型を抽象化した単一ツール factory。
 * description / inputSchema / execute の戻り値形状は従来の手書き実装と同一になる。
 */
export function createTool<TSchema extends z.ZodType, TResult>(
  config: CreateToolConfig<TSchema, TResult>
): ChatTool<z.output<TSchema>, TResult> {
  return {
    description: config.description,
    execute: async (params: z.output<TSchema>) => {
      const novelId = config.scope(params);
      if (!novelId) {
        return { error: NOVEL_NOT_SPECIFIED_ERROR };
      }
      try {
        const result = await config.handler(novelId, params);
        // Date オブジェクトなどが AI SDK の ModelMessage (JSONValue) バリデーションエラーを引き起こさないよう、
        // JSON シリアライズ可能なプレーンオブジェクトにサニタイズする
        return JSON.parse(JSON.stringify(result)) as TResult;
      } catch {
        return { error: config.errorMessage };
      }
    },
    inputSchema: config.inputSchema,
  };
}

/**
 * readTools / proposeTools に重複していた resolveNovelId 双子の単一化。
 * defaultNovelId へのフォールバック付き scope リゾルバ群を返す。
 */
export function createNovelScope(defaultNovelId?: string | null): {
  /** params.novelId があればそれを、なければバインドされた defaultNovelId を使う */
  fromParam: <TParams extends { novelId?: string | null | undefined }>(
    params: TParams
  ) => string | null;
  /** LLM による指定を受け付けず、バインドされた defaultNovelId のみを使う */
  boundOnly: () => string | null;
} {
  return {
    boundOnly: () => defaultNovelId || null,
    fromParam: (params) => params.novelId || defaultNovelId || null,
  };
}

/**
 * @deprecated createTool を使用すること。内部互換のためのエイリアス。
 */
export const scopedTool = createTool;
