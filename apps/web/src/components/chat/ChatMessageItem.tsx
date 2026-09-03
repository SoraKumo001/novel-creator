import { memo } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import type { ChatMessage } from "@/context/ChatContext.js";
import { ChatProposalCard } from "./ChatProposalCard.js";
import { extractProposalPayloads, ToolActivity } from "./ToolActivity.js";

interface ChatMessageItemProps {
  copiedId: string | null;
  isFull?: boolean;
  message: ChatMessage;
  onCopy: (content: string, id: string) => void;
}

function formatMessageTime(createdAt: unknown): string | null {
  if (typeof createdAt !== "number" && typeof createdAt !== "string") {
    return null;
  }
  try {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message: m,
  copiedId,
  isFull = false,
  onCopy,
}: ChatMessageItemProps) {
  const isUser = m.role === "user";
  const timeLabel = formatMessageTime((m as { createdAt?: unknown }).createdAt);
  const isCopied = copiedId === m.id;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <span>{isUser ? "あなた" : "AIパートナー"}</span>
        {timeLabel && (
          <time className="text-[10px] text-muted-foreground/80">
            {timeLabel}
          </time>
        )}
      </div>
      <div
        className={`rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
          isFull ? "max-w-[94%]" : "max-w-[88%]"
        } ${
          isUser
            ? "rounded-br-xs bg-primary text-primary-foreground"
            : "rounded-bl-xs border border-border bg-surface-raised text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : (
          <>
            {/* AI のツール呼び出し活動 & 思考プロセス（提案カードは下部に配置） */}
            <ToolActivity
              parts={m.parts}
              isStreaming={false}
              showProposalCards={false}
            />
            {m.content && <MarkdownText content={m.content} />}
            {/* 作成された登録用の提案カード（解説テキストの直下） */}
            {extractProposalPayloads(m.parts).map((proposal, idx) => (
              <div key={idx} className="mt-2.5">
                <ChatProposalCard proposal={proposal} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* アシスタントメッセージのアクションバー */}
      {!isUser && (
        <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => onCopy(m.content, m.id)}
            className="cursor-pointer hover:text-foreground"
            aria-label={
              isCopied ? "メッセージをコピー済み" : "メッセージをコピーする"
            }
          >
            {isCopied ? "✓ コピーしました" : "📋 コピー"}
          </button>
          <span aria-live="polite" className="sr-only">
            {isCopied ? "メッセージをコピーしました" : ""}
          </span>
        </div>
      )}
    </div>
  );
});
