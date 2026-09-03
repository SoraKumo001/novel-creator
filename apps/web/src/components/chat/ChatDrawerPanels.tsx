import type { KeyboardEvent, RefObject } from "react";
import { Button } from "@/components/Button.js";
import type { ChatFocusContext, QuickPrompt } from "@/context/ChatContext.js";

/** 空状態のウェルカム＋クイックプロンプト */
export function ChatWelcomePanel({
  prompts,
  isStreaming,
  onQuickPrompt,
}: {
  prompts: QuickPrompt[];
  isStreaming: boolean;
  onQuickPrompt: (qp: QuickPrompt) => void;
}) {
  return (
    <div className="space-y-4 py-6">
      <div className="text-center">
        <span className="text-3xl">✨</span>
        <h3 className="mt-2 font-bold text-foreground text-sm">
          AI創作パートナーへようこそ
        </h3>
        <p className="mx-auto mt-1 max-w-xs text-muted-foreground text-xs">
          設定、登場人物、プロット、シーン展開の相談など、創作に関するアイデア出しをサポートします。
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <div className="px-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          クイック相談テンプレート
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => onQuickPrompt(qp)}
              disabled={isStreaming}
              className="group flex flex-col rounded-xl border border-border bg-surface p-2.5 text-left text-xs transition hover:border-primary/50 hover:bg-surface-hover"
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-primary">
                <span>{qp.icon}</span>
                <span>{qp.title}</span>
              </div>
              <span className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {qp.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** エラー表示パネル */
export function ChatErrorPanel({
  error,
  lastPrompt,
  isStreaming,
  onClose,
  onRetry,
}: {
  error: string;
  lastPrompt: string | null;
  isStreaming: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-destructive text-xs shadow-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>エラーが発生しました</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-0.5 text-destructive/70 text-xs hover:text-destructive"
          title="閉じる"
        >
          ✕
        </button>
      </div>
      <div className="wrap-break-word max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-destructive/20 bg-background/60 p-2 font-mono text-[11px] text-foreground/90">
        {error}
      </div>
      {lastPrompt && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRetry}
            disabled={isStreaming}
            className="h-7 text-xs"
          >
            🔄 もう一度試す
          </Button>
        </div>
      )}
    </div>
  );
}

/** 入力フォーム */
export function ChatInputBar({
  chatFocus,
  input,
  isStreaming,
  textareaRef,
  onConsumeFocus,
  onTextareaInput,
  onKeyDown,
  onSend,
  onAbort,
}: {
  chatFocus: ChatFocusContext | null;
  input: string;
  isStreaming: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onConsumeFocus: () => void;
  onTextareaInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAbort: () => void;
}) {
  return (
    <div className="shrink-0 border-border border-t bg-surface p-3">
      <div className="relative flex flex-col gap-2">
        {chatFocus && (
          <div className="fade-in flex animate-in items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs duration-150">
            <div className="flex min-w-0 items-center gap-1.5 text-foreground">
              <span className="shrink-0 text-primary">📎</span>
              <span className="shrink-0 font-semibold text-primary">
                参照中:
              </span>
              <span className="truncate font-medium" title={chatFocus.title}>
                {chatFocus.title}
              </span>
            </div>
            <button
              type="button"
              onClick={onConsumeFocus}
              className="ml-2 shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              title="参照コンテキストを解除"
              aria-label="参照コンテキストを解除"
            >
              ✕
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onTextareaInput}
          onKeyDown={onKeyDown}
          placeholder="創作の相談を入力... (Ctrl + Enter で送信)"
          rows={1}
          disabled={isStreaming}
          className="max-h-45 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Ctrl + Enter で送信
          </span>
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={onAbort}
              >
                ■ 停止
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onSend}
                disabled={!input.trim()}
              >
                送信
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
