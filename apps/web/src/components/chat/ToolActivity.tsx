import { useState } from 'react';

/** ツール呼び出しのメタ情報 */
const TOOL_META: Record<string, { label: string; icon: string }> = {
  getNovelInfo: { label: '小説情報の確認', icon: '📖' },
  getCharacters: { label: '登場人物の参照', icon: '🎭' },
  getSettings: { label: '世界観・設定の参照', icon: '🌍' },
  getPlotAndChapters: { label: 'プロット・章構成の参照', icon: '📑' },
  getSectionContent: { label: '本文の参照', icon: '📝' },
  getForeshadowings: { label: '伏線の確認', icon: '🔍' },
  getTimelines: { label: '時系列・年表の確認', icon: '⏳' },
  searchNovelKnowledge: { label: '関連ナレッジの検索', icon: '🧠' },
};

export interface ToolInvocationItem {
  toolCallId: string;
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  state: 'call' | 'result' | 'partial-call';
}

/**
 * UIMessage の parts 配列からツール呼び出し一覧を抽出する
 */
export function extractToolInvocations(parts?: unknown[]): ToolInvocationItem[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];

  const items: ToolInvocationItem[] = [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;

    // AI SDK standard: type === 'tool-invocation'
    if (p.type === 'tool-invocation' && p.toolInvocation && typeof p.toolInvocation === 'object') {
      const inv = p.toolInvocation as Record<string, unknown>;
      items.push({
        toolCallId: (inv.toolCallId as string) || (inv.id as string) || Math.random().toString(),
        toolName: (inv.toolName as string) || (inv.name as string) || 'unknown',
        args: (inv.args as Record<string, unknown>) ?? {},
        result: inv.result,
        state:
          (inv.state as ToolInvocationItem['state']) ||
          (inv.result !== undefined ? 'result' : 'call'),
      });
    }
  }

  return items;
}

/** ツール引数の表示用サマリー文字列を生成する */
function formatArgsSummary(toolName: string, args?: Record<string, unknown>): string | null {
  if (!args || Object.keys(args).length === 0) return null;
  if (toolName === 'getCharacters' && args.name) {
    return `キャラクター名: ${args.name}`;
  }
  if (toolName === 'getSettings' && args.name) {
    return `設定名: ${args.name}`;
  }
  if (toolName === 'searchNovelKnowledge' && args.query) {
    return `クエリ: "${args.query}"`;
  }
  if (toolName === 'getSectionContent' && args.sectionId) {
    return `節ID: ${String(args.sectionId).slice(0, 8)}...`;
  }
  if (args.category) {
    return `カテゴリ: ${args.category}`;
  }
  return null;
}

/** ツール結果の表示用サマリー文字列を生成する */
function formatResultSummary(toolName: string, result?: unknown): string | null {
  if (result === undefined || result === null) return null;
  if (typeof result === 'object') {
    const res = result as Record<string, unknown>;
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
      return `「${res.title}」を取得`;
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

interface ToolActivityProps {
  parts?: unknown[];
  /** ストリーミング実行中かどうか */
  isStreaming?: boolean;
}

export function ToolActivity({ parts, isStreaming: _isStreaming }: ToolActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const invocations = extractToolInvocations(parts);

  if (invocations.length === 0) return null;

  return (
    <div className="mb-2 space-y-1.5 w-full">
      {invocations.map((inv) => {
        const meta = TOOL_META[inv.toolName] || { label: inv.toolName, icon: '⚙️' };
        const isDone = inv.state === 'result';
        const isExpanded = expandedId === inv.toolCallId;
        const argsSummary = formatArgsSummary(inv.toolName, inv.args);
        const resultSummary = formatResultSummary(inv.toolName, inv.result);

        return (
          <div
            key={inv.toolCallId}
            className="rounded-lg border border-border/70 bg-surface/80 text-[12px] shadow-xs backdrop-blur overflow-hidden transition"
          >
            {/* ヘッダー / アコーディオン切り替えボタン */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : inv.toolCallId)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-foreground hover:bg-surface-hover/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm shrink-0">{meta.icon}</span>
                <span className="font-medium truncate text-foreground">{meta.label}</span>

                {argsSummary && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                    ({argsSummary})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                {isDone ? (
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
                    <span>{resultSummary || '完了'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
                    <span>参照中...</span>
                  </span>
                )}

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
              </div>
            </button>

            {/* 詳細情報（アコーディオン展開時） */}
            {isExpanded && (
              <div className="border-t border-border/50 bg-background/50 p-2.5 space-y-2 text-[11px] font-mono">
                {inv.args && Object.keys(inv.args).length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-sans font-semibold">
                      入力パラメータ:
                    </span>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface p-2 text-foreground whitespace-pre-wrap">
                      {JSON.stringify(inv.args, null, 2)}
                    </pre>
                  </div>
                )}

                {inv.result !== undefined && (
                  <div>
                    <span className="text-muted-foreground font-sans font-semibold">実行結果:</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface p-2 text-foreground whitespace-pre-wrap">
                      {JSON.stringify(inv.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
