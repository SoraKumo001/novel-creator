import { z } from "zod";

/**
 * MCP 入力バリデーションの共通スキーマ。
 * zod のみを使い、Node.js / Workers の双方で動作する。
 *
 * 注意: z.object は既定で未知キーを除去（strip）する。
 * additionalProperties に相当する厳密な拒否が必要な場合は
 * 受信側で明示的に .strict() を使うこと（本ファイルの既定は寛容）。
 */

/** UUID 文字列スキーマ。 */
export const uuidSchema = z.string().uuid();

/** 上限付きテキストスキーマを生成する。 */
export function boundedText(max: number): z.ZodString {
  return z.string().max(max);
}

/** 一括系の上限（最大20件・最小1件）配列スキーマを生成する。 */
export function batchMax20<T extends z.ZodTypeAny>(item: T): z.ZodArray<T> {
  return z.array(item).min(1).max(20);
}
