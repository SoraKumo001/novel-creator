import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
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

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of settings) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [settings]);

  async function handleDelete() {
    if (!deletingId) return;
    await deleteSetting(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">設定一覧</h2>
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
          <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'markdown'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && <Loading message="設定を読み込み中..." />}
          {!loading && settings.length === 0 && (
            <EmptyState
              title="設定がありません"
              description="世界観や魔法体系などを登録しましょう。"
            />
          )}
          {!loading &&
            grouped.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {category}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((setting) => (
                    <Card key={setting.id}>
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
                      <MarkdownText
                        content={setting.description || '説明なし'}
                        className="text-sm text-slate-600 dark:text-slate-300"
                      />
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deletingId}
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
