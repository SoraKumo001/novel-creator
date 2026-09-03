import { useState } from "react";

export interface ReasoningItem {
  state?: "streaming" | "done";
  text: string;
}

/**
 * UIMessage の parts 配列から思考プロセス（reasoning）を抽出する（純関数）。
 * AI SDK v7 の parts: { type: 'reasoning', text: string, state?: 'streaming' | 'done' } に対応。
 */
export function extractReasoning(
  parts?: unknown[] | null
): ReasoningItem | null {
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const reasoningParts = parts.filter(
    (
      p
    ): p is { type: "reasoning"; text: string; state?: "streaming" | "done" } =>
      Boolean(
        p &&
          typeof p === "object" &&
          (p as { type?: unknown }).type === "reasoning" &&
          typeof (p as { text?: unknown }).text === "string"
      )
  );

  if (reasoningParts.length === 0) {
    return null;
  }

  const text = reasoningParts.map((p) => p.text || "").join("");
  if (!text.trim()) {
    return null;
  }

  const isStreaming = reasoningParts.some((p) => p.state === "streaming");
  return {
    text,
    state: isStreaming ? "streaming" : "done",
  };
}

/**
 * 思考プロセス（Reasoning）の表示用コンポーネント。
 * ストリーミング中は自動展開でリアルタイムに思考内容を表示し、完了時は折りたたみトグル可能。
 */
export function ReasoningActivity({
  reasoning,
  defaultExpanded,
}: {
  reasoning: ReasoningItem | null;
  defaultExpanded?: boolean;
}) {
  const isStreaming = reasoning?.state === "streaming";
  const [isOpen, setIsOpen] = useState<boolean>(
    () => defaultExpanded ?? isStreaming
  );

  if (!reasoning || !reasoning.text.trim()) {
    return null;
  }

  // ストリーミング中は常に開く（ユーザーが手動で閉じない限り）
  const expanded = isStreaming || isOpen;

  return (
    <div className="mb-2 w-full overflow-hidden rounded-xl border border-indigo-200/70 bg-indigo-50/50 text-[12px] shadow-xs backdrop-blur transition dark:border-indigo-900/50 dark:bg-indigo-950/30">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-indigo-950 transition hover:bg-indigo-100/50 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={`shrink-0 text-sm ${isStreaming ? "animate-pulse" : ""}`}
          >
            🧠
          </span>
          <span className="truncate font-semibold">
            {isStreaming ? "AIパートナーが思考中..." : "思考プロセス"}
          </span>
          {!isStreaming && (
            <span className="text-[10px] text-muted-foreground">
              ({reasoning.text.length.toLocaleString()}文字)
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
          {isStreaming ? (
            <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-indigo-500" />
              <span>推論中...</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {expanded ? "閉じる" : "表示"}
            </span>
          )}

          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
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

      {expanded && (
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap border-indigo-200/50 border-t bg-background/60 p-3 font-mono text-[11px] text-foreground/90 leading-relaxed dark:border-indigo-900/40">
          {reasoning.text}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-indigo-500 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}
