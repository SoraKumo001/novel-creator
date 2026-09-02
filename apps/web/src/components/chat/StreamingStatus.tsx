import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import type { StreamingProgress } from "@/hooks/useChatStreaming.js";
import { ToolActivity } from "./ToolActivity.js";

interface StreamingStatusProps {
  /** バックエンド（data-progress パーツ）由来の進捗。isStreaming 中のみ非 null */
  progress: StreamingProgress | null;
  /** ストリーミング中のリアルタイムテキスト */
  streamingContent: string;
  /** ストリーミング中のアシスタントメッセージの生 parts（ツール呼び出しの随時表示用） */
  streamingParts: UIMessage["parts"] | null;
}

/**
 * startedAt（EPOCH ms）からの経過秒数を1秒ごとにローカルで刻むフック。
 * このコンポーネント内に閉じることで、メッセージ一覧全体の再レンダー（= 再レンダーストーム）を防ぐ。
 */
function useElapsedSeconds(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState<number>(() =>
    startedAt == null
      ? 0
      : Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  );

  useEffect(() => {
    if (startedAt == null) {
      return;
    }
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return elapsed;
}

/**
 * ストリーミング中のライブステータス領域。
 * 最初のコンテンツ（テキスト or ツールカード）が流れ始めるまでは「思考中」カードを、
 * 流れ始めたら「AIパートナーが入力中...」ライン + リアルタイムバブルを表示する。
 * 経過時間とステップ進捗はコンパクトな情報として同ライン / カード内に置き、
 * バブルやツールカードの配置を押し上げない（高さの安定化）。
 */
export function StreamingStatus({
  streamingContent,
  streamingParts,
  progress,
}: StreamingStatusProps) {
  const hasContent =
    streamingContent !== "" ||
    (streamingParts != null && streamingParts.length > 0);
  const startedAt = progress?.startedAt ?? null;
  const step = progress?.step ?? 0;
  const maxSteps = progress?.maxSteps ?? 0;
  const elapsedSec = useElapsedSeconds(startedAt);
  const showStep = step >= 1;

  return (
    <div className="flex flex-col items-start space-y-1">
      {hasContent ? (
        <>
          {/* ストリーミング中: 入力中ライン（経過時間・ステップをコンパクトに添える） */}
          <div className="mb-1 flex w-full items-center gap-1.5 px-1 font-medium text-[11px] text-primary">
            <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-primary" />
            <span>AIパートナーが入力中...</span>
            <span className="ml-auto flex shrink-0 items-center gap-2 font-normal text-muted-foreground">
              <span>{elapsedSec}秒経過</span>
              {showStep && (
                <span>
                  ステップ {step} / {maxSteps}
                </span>
              )}
            </span>
          </div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-xs border border-primary/30 bg-surface-raised px-4 py-2.5 text-foreground text-sm shadow-xs">
            {/* 思考プロセス & ツール呼び出しはテキスト生成前でもリアルタイムに表示 */}
            <ToolActivity parts={streamingParts} isStreaming={true} />
            {streamingContent && (
              <MarkdownText content={streamingContent} disableMermaid={true} />
            )}
          </div>
        </>
      ) : (
        /* 最初のコンテンツがまだ流れていない: 思考中カード（経過時間・ステップ） */
        <div className="rounded-2xl rounded-bl-xs border border-border bg-surface-raised px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-primary" />
            <span className="text-muted-foreground">
              AIパートナーが思考中...
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{elapsedSec}秒経過</span>
            {showStep && (
              <span>
                ステップ {step} / {maxSteps}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
