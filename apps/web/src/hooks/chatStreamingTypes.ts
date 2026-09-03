import type { UIMessage } from "ai";

export interface ChatMessage {
  content: string;
  createdAt: number;
  id: string;
  /**
   * UI Message の生 parts（v7）。ツールパーツ（tool-<name>）表示などに使用。
   * text パーツの連結結果が content に入るが、ツールパーツは content には含まれない。
   */
  parts: UIMessage["parts"];
  role: "user" | "assistant";
}

/** バックエンド（SSE data-progress パーツ）から届く一時的な進捗ペイロード */
export type ChatProgressPhase = "start" | "step-start" | "step-finish" | "done";

export interface ChatProgress {
  finishReason?: string;
  /** 想定される総ステップ数 */
  maxSteps: number;
  phase: ChatProgressPhase;
  /** 1-based。先頭ステップ前は 0 */
  step: number;
}

/** フックが公開する進捗状態（開始時刻を記録したもの）。isStreaming 中のみ非 null になる */
export interface StreamingProgress {
  maxSteps: number;
  phase: ChatProgressPhase;
  /** 経過時間の基準時刻（EPOCH ms）。最初の data-progress 到着 or status が submitted になった時点 */
  startedAt: number;
  step: number;
}

export const PROGRESS_PHASES: ReadonlyArray<ChatProgressPhase> = [
  "start",
  "step-start",
  "step-finish",
  "done",
];

/** 未知の値（data-progress の data フィールド）を ChatProgress に絞り込む */
export function toChatProgress(value: unknown): ChatProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const v = value as Record<string, unknown>;
  const phase = v.phase;
  if (
    typeof phase !== "string" ||
    !PROGRESS_PHASES.includes(phase as ChatProgressPhase)
  ) {
    return null;
  }
  if (typeof v.step !== "number" || typeof v.maxSteps !== "number") {
    return null;
  }
  return {
    phase: phase as ChatProgressPhase,
    step: v.step,
    maxSteps: v.maxSteps,
    finishReason:
      typeof v.finishReason === "string" ? v.finishReason : undefined,
  };
}

/** UI Message からテキストパーツのみを連結して取り出す */
export function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** ツールパーツ（tool-<name> / dynamic-tool）が含まれるか */
export function hasToolPart(parts: UIMessage["parts"]): boolean {
  return parts.some((p) => {
    const t = (p as { type?: string }).type;
    return (
      typeof t === "string" && (t.startsWith("tool-") || t === "dynamic-tool")
    );
  });
}

/**
 * セッション詳細（DB行）を UI Message に変換して useChat へ seed する。
 * parts があればそれをそのまま使い、無ければ text パーツを合成する。
 * サーバーはリクエストの最後のユーザーメッセージのみを採用し履歴は DB から
 * 構築するため、ここでは id/role/parts を正しく設定する。
 */
export function rowToUIMessage(row: {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: unknown[] | null;
}): UIMessage {
  const parts: UIMessage["parts"] =
    Array.isArray(row.parts) && row.parts.length > 0
      ? (row.parts as UIMessage["parts"])
      : [{ type: "text", text: row.content, state: "done" }];
  return {
    id: row.id,
    role: row.role,
    parts,
  };
}

/** 応答メッセージからタイトル案（〜30文字）を生成する */
export function extractTitle(message: UIMessage): string {
  const text = textOf(message).trim();
  return text.replace(/\s+/g, " ").slice(0, 30);
}
