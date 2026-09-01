import type { ReindexProgressEvent } from "@/lib/types.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface ReindexProgressModalProps {
  dimensions?: number;
  error: string | null;
  isDone: boolean;
  isOpen: boolean;
  isRunning: boolean;
  onClose: () => void;
  onStart: () => void;
  progress: ReindexProgressEvent | null;
  targetModelName?: string;
}

export function ReindexProgressModal({
  isOpen,
  onClose,
  progress,
  isRunning,
  isDone,
  error,
  onStart,
  targetModelName,
  dimensions,
}: ReindexProgressModalProps) {
  const percent = progress ? progress.percent : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isRunning ? () => {} : onClose}
      title="⚡ ベクトルインデックス全再構築"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          {!isRunning && !isDone && (
            <>
              <Button variant="secondary" onClick={onClose}>
                キャンセル
              </Button>
              <Button onClick={onStart} variant="primary">
                再構築を開始
              </Button>
            </>
          )}
          {isRunning && (
            <Button variant="secondary" disabled>
              処理中...
            </Button>
          )}
          {isDone && (
            <Button variant="primary" onClick={onClose}>
              完了して閉じる
            </Button>
          )}
          {error && !isRunning && (
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {!isRunning && !isDone && !error && (
          <div className="space-y-3">
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 text-xs dark:text-amber-400">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span>⚠️</span>
                <span>インデックス再構築について</span>
              </div>
              <p className="leading-relaxed">
                全小説の登場人物、世界観設定、各節の本文を読み出し、選択中の埋め込みモデルでベクトルを再生成してインデックスを再作成します。
              </p>
              {targetModelName && (
                <div className="mt-2 border-amber-500/20 border-t pt-2 text-[11px]">
                  <strong>使用モデル:</strong> {targetModelName} (
                  {dimensions ? `${dimensions} 次元` : "自動検出"})
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              ※原本の小説データや設定テキストは削除されません。
            </p>
          </div>
        )}

        {(isRunning || isDone) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between font-semibold text-foreground text-xs">
              <span>{progress?.stage || "処理中..."}</span>
              <span>{percent}%</span>
            </div>

            {/* プログレスバー */}
            <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-surface-raised">
              <div
                className={`h-full transition-all duration-300 ${
                  isDone ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                進捗:{" "}
                {progress ? `${progress.current} / ${progress.total}` : "0 / 0"}{" "}
                件
              </span>
              {progress?.itemTitle && (
                <span className="max-w-50 truncate" title={progress.itemTitle}>
                  {progress.itemTitle}
                </span>
              )}
            </div>

            {isDone && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                ✓ 全データのベクトルインデックス再構築が完了しました！
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-600 text-xs dark:text-rose-400">
            <div className="font-bold">エラーが発生しました</div>
            <div className="mt-1">{error}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
