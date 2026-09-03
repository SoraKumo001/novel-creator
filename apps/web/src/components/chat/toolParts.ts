import type { DynamicToolUIPart, ToolUIPart, UITools } from "ai";
import { getToolName } from "ai";
import { formatCharCount } from "@/lib/format.js";

/** ツールの日本語表示名マップ */
export const TOOL_LABELS: Record<string, string> = {
  getNovelInfo: "小説情報",
  getStoryOutline: "ストーリー構想取得",
  getCharacters: "人物取得",
  getSettings: "設定取得",
  getPlotAndChapters: "プロット・章構成取得",
  getSectionContent: "本文取得",
  getForeshadowings: "伏線取得",
  getTimelines: "時系列取得",
  searchNovelKnowledge: "知識検索",
  proposeCreateCharacter: "人物登録提案",
  proposeCreateSetting: "設定登録提案",
  proposeAddForeshadowing: "伏線登録提案",
  proposeAddTimelineEvent: "年表追加提案",
  proposeUpdatePlot: "プロット更新提案",
  proposeUpdateStoryOutline: "ストーリー構想更新提案",
  proposeBulkCreate: "一括設定登録提案",
};

/** ツール呼び出しの表示用アイコン */
export const TOOL_ICONS: Record<string, string> = {
  getNovelInfo: "📖",
  getStoryOutline: "📑",
  getCharacters: "🎭",
  getSettings: "🌍",
  getPlotAndChapters: "📑",
  getSectionContent: "📝",
  getForeshadowings: "🔍",
  getTimelines: "⏳",
  searchNovelKnowledge: "🧠",
  proposeCreateCharacter: "💡",
  proposeCreateSetting: "💡",
  proposeAddForeshadowing: "💡",
  proposeAddTimelineEvent: "💡",
  proposeUpdatePlot: "💡",
  proposeUpdateStoryOutline: "💡",
  proposeBulkCreate: "💡",
};

/** AI SDK v7 のツールパーツ（静的 tool-<name> / 動的 dynamic-tool の両方） */
export type AnyToolUIPart = ToolUIPart<UITools> | DynamicToolUIPart;

/** v7 ツールパーツの state */
export type ToolPartState = AnyToolUIPart["state"];

export interface ToolInvocationItem {
  /** state が 'output-error' のときのエラーテキスト */
  errorText?: string;
  /** state が 'output-available' のとき true */
  hasOutput: boolean;
  /** ツール引数（input）。state に応じて未定義のことがある */
  input?: unknown;
  /** 実行結果（output）。state が 'output-available' のときのみ */
  output?: unknown;
  state: ToolPartState;
  toolCallId: string;
  /** v7 ツール名（type の 'tool-' サフィックス / dynamic-tool の toolName） */
  toolName: string;
}

/**
 * 構造チェックでパーツがツールパーツかどうかを判定する。
 * `tool-xxx`（動的 ID サフィックス付き含む）と `dynamic-tool` の両方を拾う。
 */
function isToolPartLike(part: unknown): part is AnyToolUIPart {
  if (!part || typeof part !== "object") {
    return false;
  }
  const p = part as { type?: unknown; toolCallId?: unknown };
  if (typeof p.toolCallId !== "string" || p.toolCallId.length === 0) {
    return false;
  }
  return (
    typeof p.type === "string" &&
    (p.type.startsWith("tool-") || p.type === "dynamic-tool")
  );
}

/**
 * ツールパーツからツール名を取得する。
 * ai パッケージの getToolName ヘルパーを使用し、失敗時は構造的にフォールバックする。
 */
function resolveToolName(part: AnyToolUIPart): string {
  try {
    return getToolName(part as Parameters<typeof getToolName>[0]);
  } catch {
    const p = part as { type: string; toolName?: string };
    if (p.type === "dynamic-tool") {
      return p.toolName ?? "unknown";
    }
    return p.type.slice("tool-".length);
  }
}

/**
 * UIMessage の parts 配列からツール呼び出し一覧を抽出する（純関数）。
 * AI SDK v7 のパーツ形式（type が 'tool-<name>' / 'dynamic-tool'）に対応。
 */
export function extractToolInvocations(
  parts?: unknown[] | null
): ToolInvocationItem[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [];
  }

  const items: ToolInvocationItem[] = [];

  for (const part of parts) {
    if (!isToolPartLike(part)) {
      continue;
    }

    const state = part.state as ToolPartState;
    items.push({
      toolCallId: part.toolCallId,
      toolName: resolveToolName(part),
      state,
      hasOutput: state === "output-available",
      input: "input" in part ? part.input : undefined,
      output:
        state === "output-available"
          ? (part as { output?: unknown }).output
          : undefined,
      errorText:
        state === "output-error"
          ? String((part as { errorText?: unknown }).errorText ?? "")
          : undefined,
    });
  }

  return items;
}

/** ツール名の日本語表示ラベルを返す（未知のツール名はそのまま） */
export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

/** ツール名に対応する表示アイコンを返す（未知は汎用アイコン） */
export function toolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] ?? "⚙️";
}

/** ツール引数の表示用サマリー文字列を生成する */
export function formatArgsSummary(
  toolName: string,
  input: unknown
): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const args = input as Record<string, unknown>;
  if (Object.keys(args).length === 0) {
    return null;
  }
  if (toolName === "proposeBulkCreate") {
    const chars = Array.isArray(args.characters) ? args.characters.length : 0;
    const sets = Array.isArray(args.settings) ? args.settings.length : 0;
    const fores = Array.isArray(args.foreshadowings)
      ? args.foreshadowings.length
      : 0;
    const times = Array.isArray(args.timelines) ? args.timelines.length : 0;
    return `合計 ${chars + sets + fores + times} 件 (人物:${chars}, 設定:${sets}, 伏線:${fores}, 年表:${times})`;
  }
  if (args.name) {
    return `名前: ${String(args.name)}`;
  }
  if (toolName === "searchNovelKnowledge" && args.query) {
    return `クエリ: "${String(args.query)}"`;
  }
  if (args.sectionId) {
    return `節ID: ${String(args.sectionId).slice(0, 8)}...`;
  }
  if (args.category) {
    return `カテゴリ: ${String(args.category)}`;
  }
  return null;
}

/** ツール結果の表示用サマリー文字列を生成する */
export function formatResultSummary(output: unknown): string | null {
  if (output === undefined || output === null) {
    return null;
  }
  if (typeof output === "object") {
    const res = output as Record<string, unknown>;
    if (res.error) {
      return String(res.error);
    }
    if (typeof res.count === "number") {
      return `${res.count} 件取得`;
    }
    if (typeof res.chapterCount === "number") {
      return `${res.chapterCount} 章の構成を取得`;
    }
    if (res.title) {
      return `「${String(res.title)}」を取得`;
    }
    if (Array.isArray(res.characters) && res.characters.length > 0) {
      return `${res.characters.length} 件のキャラクターを取得`;
    }
    if (Array.isArray(res.settings) && res.settings.length > 0) {
      return `${res.settings.length} 件の設定を取得`;
    }
  }
  return "完了";
}

/** JSON プレビュー用の上限文字数 */
export const PREVIEW_LIMIT = 2000;

/** JSON プレビュー用の文字列化（長い場合は切り詰める） */
export function toPreviewJson(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    json = String(value);
  }
  if (json.length > PREVIEW_LIMIT) {
    return `${json.slice(0, PREVIEW_LIMIT)}\n… (残り ${formatCharCount(json.length - PREVIEW_LIMIT)})`;
  }
  return json;
}
