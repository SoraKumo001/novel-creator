import { useState } from 'react';
import { getToolName } from 'ai';
import type { ToolUIPart, DynamicToolUIPart, UITools } from 'ai';
import { ChatProposalCard, type ProposalPayload } from './ChatProposalCard.js';

/** ツールの日本語表示名マップ */
const TOOL_LABELS: Record<string, string> = {
  getNovelInfo: '小説情報',
  getCharacters: '人物取得',
  getSettings: '設定取得',
  getPlotAndChapters: 'プロット・章構成取得',
  getSectionContent: '本文取得',
  getForeshadowings: '伏線取得',
  getTimelines: '時系列取得',
  searchNovelKnowledge: '知識検索',
  proposeCreateCharacter: '人物登録提案',
  proposeCreateSetting: '設定登録提案',
  proposeAddForeshadowing: '伏線登録提案',
  proposeAddTimelineEvent: '年表追加提案',
  proposeUpdatePlot: 'プロット更新提案',
};

/** ツール呼び出しの表示用アイコン */
const TOOL_ICONS: Record<string, string> = {
  getNovelInfo: '📖',
  getCharacters: '🎭',
  getSettings: '🌍',
  getPlotAndChapters: '📑',
  getSectionContent: '📝',
  getForeshadowings: '🔍',
  getTimelines: '⏳',
  searchNovelKnowledge: '🧠',
  proposeCreateCharacter: '💡',
  proposeCreateSetting: '💡',
  proposeAddForeshadowing: '💡',
  proposeAddTimelineEvent: '💡',
  proposeUpdatePlot: '💡',
};

/** AI SDK v7 のツールパーツ（静的 tool-<name> / 動的 dynamic-tool の両方） */
type AnyToolUIPart = ToolUIPart<UITools> | DynamicToolUIPart;

/** v7 ツールパーツの state */
export type ToolPartState = AnyToolUIPart['state'];

export interface ToolInvocationItem {
  toolCallId: string;
  /** v7 ツール名（type の 'tool-' サフィックス / dynamic-tool の toolName） */
  toolName: string;
  state: ToolPartState;
  /** state が 'output-available' のとき true */
  hasOutput: boolean;
  /** ツール引数（input）。state に応じて未定義のことがある */
  input?: unknown;
  /** 実行結果（output）。state が 'output-available' のときのみ */
  output?: unknown;
  /** state が 'output-error' のときのエラーテキスト */
  errorText?: string;
}

/**
 * 構造チェックでパーツがツールパーツかどうかを判定する。
 * `tool-xxx`（動的 ID サフィックス付き含む）と `dynamic-tool` の両方を拾う。
 */
function isToolPartLike(part: unknown): part is AnyToolUIPart {
  if (!part || typeof part !== 'object') return false;
  const p = part as { type?: unknown; toolCallId?: unknown };
  if (typeof p.toolCallId !== 'string' || p.toolCallId.length === 0) return false;
  return typeof p.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool');
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
    if (p.type === 'dynamic-tool') return p.toolName ?? 'unknown';
    return p.type.slice('tool-'.length);
  }
}

/**
 * UIMessage の parts 配列からツール呼び出し一覧を抽出する（純関数）。
 * AI SDK v7 のパーツ形式（type が 'tool-<name>' / 'dynamic-tool'）に対応。
 */
export function extractToolInvocations(parts?: unknown[] | null): ToolInvocationItem[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];

  const items: ToolInvocationItem[] = [];

  for (const part of parts) {
    if (!isToolPartLike(part)) continue;

    const state = part.state as ToolPartState;
    items.push({
      toolCallId: part.toolCallId,
      toolName: resolveToolName(part),
      state,
      hasOutput: state === 'output-available',
      input: 'input' in part ? part.input : undefined,
      output: state === 'output-available' ? (part as { output?: unknown }).output : undefined,
      errorText:
        state === 'output-error'
          ? String((part as { errorText?: unknown }).errorText ?? '')
          : undefined,
    });
  }

  return items;
}

/** ツール名の日本語表示ラベルを返す（未知のツール名はそのまま） */
export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

/** ツール引数の表示用サマリー文字列を生成する */
function formatArgsSummary(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const args = input as Record<string, unknown>;
  if (Object.keys(args).length === 0) return null;
  if (args.name) {
    return `名前: ${String(args.name)}`;
  }
  if (toolName === 'searchNovelKnowledge' && args.query) {
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
function formatResultSummary(output: unknown): string | null {
  if (output === undefined || output === null) return null;
  if (typeof output === 'object') {
    const res = output as Record<string, unknown>;
    if (res.error) {
      return String(res.error);
    }
    if (typeof res.count === 'number') {
      return `${res.count} 件取得`;
    }
    if (typeof res.chapterCount === 'number') {
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
  return '完了';
}

/** JSON プレビュー用の文字列化（長い場合は切り詰める） */
const PREVIEW_LIMIT = 2000;

function toPreviewJson(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    json = String(value);
  }
  if (json.length > PREVIEW_LIMIT) {
    return `${json.slice(0, PREVIEW_LIMIT)}\n… (残り ${(json.length - PREVIEW_LIMIT).toLocaleString()} 文字)`;
  }
  return json;
}

/** state ごとのステータス表示 */
function StatusBadge({ item }: { item: ToolInvocationItem }) {
  switch (item.state) {
    case 'output-available': {
      const summary = formatResultSummary(item.output);
      return (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
          <span>{summary || '完了'}</span>
        </span>
      );
    }
    case 'output-error':
      return (
        <span className="flex items-center gap-1 text-destructive font-medium">
          <span aria-hidden>⚠️</span>
          <span>エラー</span>
        </span>
      );
    case 'output-denied':
      return <span className="text-muted-foreground font-medium">拒否されました</span>;
    case 'approval-requested':
      return <span className="text-amber-600 dark:text-amber-400 font-medium">承認待ち...</span>;
    case 'approval-responded':
      return <span className="text-primary font-medium">承認済み・実行中...</span>;
    case 'input-streaming':
      return (
        <span className="flex items-center gap-1 text-primary font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
          <span>実行準備中...</span>
        </span>
      );
    case 'input-available':
    default:
      return (
        <span className="flex items-center gap-1 text-primary font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
          <span>実行中...</span>
        </span>
      );
  }
}

interface ToolActivityProps {
  /** UIMessage の parts 配列（tool パーツのみ抽出して表示する） */
  parts?: unknown[] | null;
  /** ストリーミング実行中かどうか（現状は state から導出するため未使用 / 将来用） */
  isStreaming?: boolean;
}

export function ToolActivity({ parts, isStreaming: _isStreaming }: ToolActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const invocations = extractToolInvocations(parts);

  if (invocations.length === 0) return null;

  return (
    <div className="mb-2 space-y-1.5 w-full max-w-[88%]">
      {invocations.map((inv) => {
        const label = toolLabel(inv.toolName);
        const icon = TOOL_ICONS[inv.toolName] ?? '⚙️';
        const isExpanded = expandedId === inv.toolCallId;
        const argsSummary = formatArgsSummary(inv.toolName, inv.input);
        const hasInput = inv.input !== undefined && inv.input !== null;
        const hasErrorText = !!inv.errorText;

        // 展開可能な中身があるときだけアコーディオン化
        const expandable = hasInput || inv.hasOutput || hasErrorText;

        return (
          <div
            key={inv.toolCallId}
            className={`rounded-lg border text-[12px] shadow-xs backdrop-blur overflow-hidden transition ${
              inv.state === 'output-error'
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-border/70 bg-surface/80'
            }`}
          >
            {/* ヘッダー / アコーディオン切り替えボタン */}
            <button
              type="button"
              onClick={() => {
                if (!expandable) return;
                setExpandedId(isExpanded ? null : inv.toolCallId);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-foreground transition ${
                expandable ? 'hover:bg-surface-hover/80 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm shrink-0">{icon}</span>
                <span className="font-medium truncate text-foreground">{label}</span>

                {argsSummary && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-40">
                    ({argsSummary})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                <StatusBadge item={inv} />

                {expandable && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>

            {/* 詳細情報（アコーディオン展開時）: input / output を JSON プレビュー */}
            {isExpanded && expandable && (
              <div className="border-t border-border/50 bg-background/50 p-2.5 space-y-2 text-[11px] font-mono">
                {hasInput && (
                  <div>
                    <span className="text-muted-foreground font-sans font-semibold">
                      入力パラメータ:
                    </span>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface p-2 text-foreground whitespace-pre-wrap">
                      {toPreviewJson(inv.input)}
                    </pre>
                  </div>
                )}

                {inv.hasOutput && (
                  <div>
                    <span className="text-muted-foreground font-sans font-semibold">実行結果:</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface p-2 text-foreground whitespace-pre-wrap">
                      {toPreviewJson(inv.output)}
                    </pre>
                  </div>
                )}

                {hasErrorText && (
                  <div>
                    <span className="text-destructive font-sans font-semibold">エラー:</span>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-destructive/10 p-2 text-destructive whitespace-pre-wrap">
                      {inv.errorText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 提案ツール（Propose Tools）の承認カード（アコーディオンの開閉によらず常時表示） */}
            {inv.hasOutput &&
              typeof inv.output === 'object' &&
              inv.output !== null &&
              (inv.output as { type?: string }).type === 'proposal' && (
                <div className="border-t border-indigo-100 bg-white/40 p-2 dark:border-indigo-900/30 dark:bg-slate-900/40">
                  <ChatProposalCard proposal={inv.output as ProposalPayload} />
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
