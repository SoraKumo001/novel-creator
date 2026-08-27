import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Loading } from '@/components/Loading.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useSettings } from '@/hooks/useSettings.js';
import type { Setting } from '@/lib/types.js';
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from './-Icons.js';
import { SettingsMarkdownEditor } from './-SettingsMarkdownEditor.js';

export function SettingsTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    settings,
    loading,
    deleteSetting,
    deleting,
    fetchSettingsMarkdown,
    saveSettingsMarkdown,
    editSettingSection,
    editSettingDocument,
    savingMarkdown,
    editingSection,
    editingDocument,
  } = useSettings(novel.id);
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const isDraggingRef = useRef(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of settings) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [settings]);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.max(160, Math.min(500, moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  async function handleDelete() {
    if (!deletingId) return;
    await deleteSetting(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
        <h2 className="text-xl font-bold text-foreground">設定一覧</h2>
        <div className="flex items-center gap-2">
          {viewMode === 'cards' && (
            <Button
              onClick={() =>
                navigate({ to: '/novels/$novelId/settings/new', params: { novelId: novel.id } })
              }
              leftIcon={<PlusIcon />}
            >
              新規作成
            </Button>
          )}
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'cards'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'markdown'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              マークダウン編集
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'markdown' ? (
        <div className="min-h-0 flex-1">
          <SettingsMarkdownEditor
            novelId={novel.id}
            fetchSettingsMarkdown={fetchSettingsMarkdown}
            saveSettingsMarkdown={saveSettingsMarkdown}
            editSettingSection={editSettingSection}
            editSettingDocument={editSettingDocument}
            savingMarkdown={savingMarkdown}
            editingSection={editingSection}
            editingDocument={editingDocument}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {/* 左サイドバー: 目次 (カテゴリ / 設定) */}
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="shrink-0 border-r border-border bg-surface overflow-y-auto p-2 text-xs"
          >
            <div className="font-semibold text-muted-foreground px-2 py-1 mb-1">
              目次 (カテゴリ / 設定)
            </div>
            {settings.length === 0 ? (
              <div className="text-muted-foreground p-2 italic">設定がありません</div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category} className="mb-2">
                  <button
                    type="button"
                    onClick={() => scrollToElement(`setting-cat-${category}`)}
                    className="w-full text-left font-bold text-foreground px-2 py-1 bg-surface-raised rounded hover:bg-surface-hover transition truncate block"
                    title={category}
                  >
                    {category}
                  </button>
                  <div className="ml-2 mt-1 space-y-0.5">
                    {items.map((setting) => (
                      <button
                        key={setting.id}
                        type="button"
                        onClick={() => scrollToElement(`setting-${setting.id}`)}
                        className="w-full text-left px-2 py-1 rounded truncate block text-foreground hover:bg-surface-raised hover:text-primary transition"
                        title={setting.name}
                      >
                        {setting.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </aside>

          {/* リサイザブルスプリッター */}
          <div
            onMouseDown={handleSplitterMouseDown}
            className="w-1.5 hover:w-2 -ml-0.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors shrink-0 select-none z-10"
            title="ドラッグして幅を調整"
          />

          {/* 右メイン領域: カードグリッド */}
          <main className="min-h-0 flex-1 overflow-y-auto p-4 space-y-8">
            {loading && <Loading message="設定を読み込み中..." />}
            {!loading && settings.length === 0 && (
              <EmptyState
                title="設定がありません"
                description="世界観や魔法体系などを登録しましょう。"
              />
            )}
            {!loading &&
              grouped.map(([category, items]) => (
                <section key={category} id={`setting-cat-${category}`} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
                    <h3 className="text-sm font-bold text-foreground">{category}</h3>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                      {items.length}件
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((setting) => (
                      <div key={setting.id} id={`setting-${setting.id}`} className="scroll-mt-4">
                        <Card className="flex h-56 flex-col justify-between overflow-hidden">
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="shrink-0">
                              <CardHeader
                                title={setting.name}
                                action={
                                  <div className="flex gap-1">
                                    <IconButton
                                      label="編集"
                                      onClick={() =>
                                        navigate({
                                          to: '/novels/$novelId/settings/$settingId',
                                          params: { novelId: novel.id, settingId: setting.id },
                                        })
                                      }
                                      icon={<PencilIcon />}
                                    />
                                    <IconButton
                                      label="削除"
                                      onClick={() => setDeletingId(setting.id)}
                                      icon={<TrashIcon />}
                                    />
                                  </div>
                                }
                              />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-foreground-secondary">
                              <MarkdownText
                                content={setting.description || '説明なし'}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </main>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteInstructionIdOrTarget(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="設定を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function deleteInstructionIdOrTarget(deletingId: string | null): boolean {
  return !!deletingId;
}
