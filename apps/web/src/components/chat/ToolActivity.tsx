import { useState } from "react";
import { ChatProposalCard, type ProposalPayload } from "./ChatProposalCard.js";
import { extractReasoning, ReasoningActivity } from "./ReasoningActivity.js";
import {
  extractToolInvocations,
  formatArgsSummary,
  formatResultSummary,
  type ToolInvocationItem,
  toolIcon,
  toolLabel,
  toPreviewJson,
} from "./toolParts.js";

export {
  extractReasoning,
  ReasoningActivity,
  type ReasoningItem,
} from "./ReasoningActivity.js";
// 互換のための再エクスポート（既存の import パスを維持する）
export {
  extractToolInvocations,
  type ToolInvocationItem,
  toolLabel,
} from "./toolParts.js";
export type { ProposalPayload };

/**
 * UIMessage の parts 配列から提案ペイロード一覧を抽出する（純関数）。
 */
export function extractProposalPayloads(
  parts?: unknown[] | null
): ProposalPayload[] {
  const invocations = extractToolInvocations(parts);
  const proposals: ProposalPayload[] = [];
  for (const inv of invocations) {
    if (
      inv.hasOutput &&
      typeof inv.output === "object" &&
      inv.output !== null &&
      (inv.output as { type?: string }).type === "proposal"
    ) {
      proposals.push(inv.output as ProposalPayload);
    }
  }
  return proposals;
}

/** state ごとのステータス表示 */
function StatusBadge({ item }: { item: ToolInvocationItem }) {
  switch (item.state) {
    case "output-available": {
      const summary = formatResultSummary(item.output);
      return (
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
          <span>{summary || "完了"}</span>
        </span>
      );
    }
    case "output-error":
      return (
        <span className="flex items-center gap-1 font-medium text-danger">
          <span aria-hidden>⚠️</span>
          <span>エラー</span>
        </span>
      );
    case "output-denied":
      return (
        <span className="font-medium text-muted-foreground">
          拒否されました
        </span>
      );
    case "approval-requested":
      return (
        <span className="font-medium text-amber-600 dark:text-amber-400">
          承認待ち...
        </span>
      );
    case "approval-responded":
      return (
        <span className="font-medium text-primary">承認済み・実行中...</span>
      );
    case "input-streaming":
      return (
        <span className="flex items-center gap-1 font-medium text-primary">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary/60 motion-reduce:animate-none" />
          <span>実行準備中...</span>
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 font-medium text-primary">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-primary motion-reduce:animate-none" />
          <span>実行中...</span>
        </span>
      );
  }
}

export interface ToolActivityProps {
  /** ストリーミング実行中かどうか */
  isStreaming?: boolean;
  /** UIMessage の parts 配列（tool パーツおよび reasoning パーツを抽出して表示する） */
  parts?: unknown[] | null;
  /** 提案カード（ChatProposalCard）をインライン表示するかどうか。デフォルト true。 */
  showProposalCards?: boolean;
}

export function ToolActivity({
  parts,
  isStreaming,
  showProposalCards = true,
}: ToolActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const invocations = extractToolInvocations(parts);
  const reasoning = extractReasoning(parts);

  if (invocations.length === 0 && !reasoning) {
    return null;
  }

  return (
    <div className="mb-2 w-full space-y-1.5">
      {/* 思考プロセス（Reasoning）の表示 */}
      {reasoning && (
        <ReasoningActivity
          reasoning={reasoning}
          defaultExpanded={isStreaming}
        />
      )}

      {/* ツール実行アクティビティの表示 */}
      {invocations.length > 0 && (
        <div className="space-y-1.5">
          {invocations.map((inv) => {
            const label = toolLabel(inv.toolName);
            const icon = toolIcon(inv.toolName);
            const isExpanded = expandedId === inv.toolCallId;
            const argsSummary = formatArgsSummary(inv.toolName, inv.input);
            const hasInput = inv.input !== undefined && inv.input !== null;
            const hasErrorText = !!inv.errorText;

            // 展開可能な中身があるときだけアコーディオン化
            const expandable = hasInput || inv.hasOutput || hasErrorText;

            return (
              <div
                key={inv.toolCallId}
                className={`overflow-hidden rounded-lg border text-[12px] shadow-xs backdrop-blur transition motion-reduce:transition-none ${
                  inv.state === "output-error"
                    ? "border-danger/40 bg-danger/5"
                    : "border-border/70 bg-surface/80"
                }`}
              >
                {/* ヘッダー / アコーディオン切り替えボタン */}
                <button
                  type="button"
                  onClick={() => {
                    if (!expandable) {
                      return;
                    }
                    setExpandedId(isExpanded ? null : inv.toolCallId);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-foreground transition ${
                    expandable
                      ? "cursor-pointer hover:bg-surface-hover/80"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="shrink-0 text-sm">{icon}</span>
                    <span className="truncate font-medium text-foreground">
                      {label}
                    </span>

                    {argsSummary && (
                      <span className="max-w-40 truncate text-[11px] text-muted-foreground">
                        ({argsSummary})
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                    <StatusBadge item={inv} />

                    {expandable && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${
                          isExpanded ? "rotate-180" : ""
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
                  <div className="space-y-2 border-border/50 border-t bg-background/50 p-2.5 font-mono text-[11px]">
                    {hasInput && (
                      <div>
                        <span className="font-sans font-semibold text-muted-foreground">
                          入力パラメータ:
                        </span>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 text-foreground">
                          {toPreviewJson(inv.input)}
                        </pre>
                      </div>
                    )}

                    {inv.hasOutput && (
                      <div>
                        <span className="font-sans font-semibold text-muted-foreground">
                          実行結果:
                        </span>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 text-foreground">
                          {toPreviewJson(inv.output)}
                        </pre>
                      </div>
                    )}

                    {hasErrorText && (
                      <div>
                        <span className="font-sans font-semibold text-danger">
                          エラー:
                        </span>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-danger/10 p-2 text-danger">
                          {inv.errorText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* 提案ツール（Propose Tools）の承認カード（アコーディオンの開閉によらず常時表示） */}
                {showProposalCards &&
                  inv.hasOutput &&
                  typeof inv.output === "object" &&
                  inv.output !== null &&
                  (inv.output as { type?: string }).type === "proposal" && (
                    <div className="border-indigo-100 border-t bg-white/40 p-2 dark:border-indigo-900/30 dark:bg-slate-900/40">
                      <ChatProposalCard
                        proposal={inv.output as ProposalPayload}
                      />
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
