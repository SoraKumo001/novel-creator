import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { ReindexProgressEvent } from '@/lib/types.js';

interface ReindexProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ReindexProgressEvent | null;
  isRunning: boolean;
  isDone: boolean;
  error: string | null;
  onStart: () => void;
  targetModelName?: string;
  dimensions?: number;
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
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>⚠️</span>
                <span>インデックス再構築について</span>
              </div>
              <p className="leading-relaxed">
                全小説の登場人物、世界観設定、各節の本文を読み出し、選択中の埋め込みモデルでベクトルを再生成してインデックスを再作成します。
              </p>
              {targetModelName && (
                <div className="mt-2 pt-2 border-t border-amber-500/20 text-[11px]">
                  <strong>使用モデル:</strong> {targetModelName} (
                  {dimensions ? `${dimensions} 次元` : '自動検出'})
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ※原本の小説データや設定テキストは削除されません。
            </p>
          </div>
        )}

        {(isRunning || isDone) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>{progress?.stage || '処理中...'}</span>
              <span>{percent}%</span>
            </div>

            {/* プログレスバー */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-raised border border-border">
              <div
                className={`h-full transition-all duration-300 ${
                  isDone ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>進捗: {progress ? `${progress.current} / ${progress.total}` : '0 / 0'} 件</span>
              {progress?.itemTitle && (
                <span className="truncate max-w-[200px]" title={progress.itemTitle}>
                  {progress.itemTitle}
                </span>
              )}
            </div>

            {isDone && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ 全データのベクトルインデックス再構築が完了しました！
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <div className="font-bold">エラーが発生しました</div>
            <div className="mt-1">{error}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
