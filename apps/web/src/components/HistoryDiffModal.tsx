import { useMemo, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { useHistories } from '@/hooks/useHistories.js';
import { useTheme } from '@/hooks/useTheme.js';
import type { HistoryItem } from '@/lib/services/index.js';

interface HistoryDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  novelId: string;
  entityType: string;
  entityId: string;
  currentContent: string;
  title: string;
  onRestoreSuccess?: (restoredContent: string) => void;
}

export function HistoryDiffModal({
  isOpen,
  onClose,
  novelId,
  entityType,
  entityId,
  currentContent,
  title,
  onRestoreSuccess,
}: HistoryDiffModalProps) {
  const { resolvedTheme } = useTheme();
  const { histories, loading, restore, restoring } = useHistories({
    novelId,
    entityType,
    entityId,
    enabled: isOpen,
  });

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // 初期ロード時、最新の履歴を選択
  const activeHistory: HistoryItem | undefined = useMemo(() => {
    if (selectedHistoryId) {
      return histories.find((h) => h.id === selectedHistoryId);
    }
    return histories[0];
  }, [histories, selectedHistoryId]);

  // 過去バージョンのテキストを抽出（JSONの場合は整形して読みやすくする）
  const originalText = useMemo(() => {
    if (!activeHistory) return '';
    try {
      if (activeHistory.entityType === 'setting' || activeHistory.entityType === 'character') {
        const parsed = JSON.parse(activeHistory.content);
        if (typeof parsed === 'object' && parsed !== null && 'description' in parsed) {
          return parsed.description as string;
        }
      }
    } catch {
      // JSONでなければそのまま
    }
    return activeHistory.content;
  }, [activeHistory]);

  const handleRestore = async () => {
    if (!activeHistory) return;
    try {
      await restore(activeHistory.id);
      setConfirmRestoreOpen(false);
      onRestoreSuccess?.(originalText);
      onClose();
    } catch (e) {
      console.error('Failed to restore history:', e);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`編集履歴と差分: ${title}`}
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              <span>過去バージョン（左/赤）</span>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ml-2" />
              <span>現在の内容（右/緑）</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                閉じる
              </Button>
              <Button
                variant="primary"
                onClick={() => setConfirmRestoreOpen(true)}
                disabled={!activeHistory || restoring}
                isLoading={restoring}
              >
                このバージョンに復元
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex h-[620px] w-full flex-col min-h-0 space-y-3">
          {/* 上部コントロールバー */}
          <div className="flex shrink-0 items-center justify-between border-b border-border pb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">履歴件数: {histories.length} 件</span>
              {activeHistory && (
                <span className="text-muted-foreground">
                  （選択中: {new Date(activeHistory.createdAt).toLocaleString('ja-JP')}）
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-foreground select-none">
                <input
                  type="checkbox"
                  checked={renderSideBySide}
                  onChange={(e) => setRenderSideBySide(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                左右並列で比較（Side-by-Side）
              </label>
            </div>
          </div>

          {/* メイン差分エリア: 左右2カラム */}
          <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
            {/* 左カラム: 履歴タイムラインリスト (260px) */}
            <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-border bg-surface-raised/40 p-2 space-y-1.5 text-xs">
              {loading ? (
                <Loading message="履歴を読み込み中..." />
              ) : histories.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground italic">
                  まだ編集履歴がありません
                </div>
              ) : (
                histories.map((item, index) => {
                  const isSelected = activeHistory?.id === item.id;
                  const dateStr = new Date(item.createdAt).toLocaleString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedHistoryId(item.id)}
                      className={`block w-full rounded-lg p-2.5 text-left transition border ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-xs font-medium dark:bg-primary/20'
                          : 'border-transparent bg-surface hover:border-border hover:bg-surface-raised text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold">{dateStr}</span>
                        {index === 0 && (
                          <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] text-primary font-bold">
                            最新
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-foreground/90 font-medium">
                        {item.description || '変更保存'}
                      </div>
                      {item.wordCount !== undefined && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {item.wordCount.toLocaleString()} 文字
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 右カラム: Monaco DiffEditor (flex-1) */}
            <div className="flex-1 min-w-0 h-full rounded-lg border border-border overflow-hidden bg-surface relative shadow-inner">
              {activeHistory ? (
                <DiffEditor
                  key={`${renderSideBySide ? 'side' : 'inline'}-${activeHistory.id}`}
                  height="100%"
                  original={originalText}
                  modified={currentContent}
                  language="markdown"
                  theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    renderSideBySide,
                    useInlineViewWhenSpaceIsLimited: false,
                    renderSideBySideInlineBreakpoint: 0,
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    smoothScrolling: true,
                    padding: { top: 12, bottom: 12 },
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  左側から比較したい履歴を選択してください
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        onConfirm={handleRestore}
        title="このバージョンに復元しますか？"
        message={`選択した過去バージョン（${
          activeHistory ? new Date(activeHistory.createdAt).toLocaleString('ja-JP') : ''
        }）の内容で現在のデータを上書きします。未保存の変更は失われます。`}
        confirmLabel="復元する"
        cancelLabel="キャンセル"
        isLoading={restoring}
      />
    </>
  );
}
