import { z } from "zod";

/**
 * proposeTools / readTools で繰り返し定義されていた zod フラグメントと
 * schema + handler テーブル定義の共通型を集約するモジュール。
 * 各ツールの公開シグネチャ（ツール名・description・入出力形状・実行結果）は
 * 従来通りであり、本モジュールの追加による破壊的変更はない。
 */

/** 対象小説ID（省略時は現在の相談対象小説）。全 fromParam ツールで同一文言。 */
export const novelIdParam = z
  .string()
  .optional()
  .describe("対象の小説ID（省略時は現在の相談対象小説）");

/** 伏線ステータスの共通 enum。propose / read / shared の 3 値と一致する。 */
export const foreshadowingStatusValue = z.enum([
  "unresolved",
  "resolved",
  "abandoned",
]);
export type ForeshadowingStatusValue = z.output<
  typeof foreshadowingStatusValue
>;

/** 削除・更新理由の任意パラメータ。 */
export const reasonParam = z
  .string()
  .optional()
  .describe("この操作を提案する理由・背景の説明");

/**
 * schema + handler のテーブル定義1行分。
 * createTool にそのまま展開できる形状にし、テーブル側で型推論が効くようにする。
 */
export interface ScopedToolDefinition<TSchema extends z.ZodType, TResult> {
  /** LLM に渡るツールの説明 */
  description: string;
  /** handler が例外を投げた場合に { error } として返すメッセージ */
  errorMessage: string;
  /** 解決済み小説IDとパラメータを受け取るツール本体 */
  handler: (
    novelId: string,
    params: z.output<TSchema>
  ) => TResult | Promise<TResult>;
  /** LLM に渡るツールの入力スキーマ */
  inputSchema: TSchema;
}
