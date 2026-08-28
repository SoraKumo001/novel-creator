import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Loading } from '@/components/Loading.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { Tag } from '@/components/Tag.js';
import { useCharacters } from '@/hooks/useCharacters.js';
import { useNovel } from '@/hooks/useNovel.js';
import type { Character } from '@/lib/types.js';
import { CharactersMarkdownEditor } from './-CharactersMarkdownEditor.js';
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from './-Icons.js';

export function CharactersTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    characters,
    loading,
    deleteCharacter,
    fetchCharactersMarkdown,
    saveCharactersMarkdown,
    editCharacterSection,
    editCharacterDocument,
    deleting,
    savingMarkdown,
    editingSection,
    editingDocument,
  } = useCharacters(novel.id);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const isDraggingRef = useRef(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Character[]>();
    for (const c of characters) {
      const cat = c.category || '未分類';
      const list = map.get(cat) ?? [];
      list.push(c);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [characters]);

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
    await deleteCharacter(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
        <h2 className="text-xl font-bold text-foreground">人物一覧</h2>
        <div className="flex items-center gap-2">
          {viewMode === 'cards' && (
            <Button
              onClick={() =>
                navigate({ to: '/novels/$novelId/characters/new', params: { novelId: novel.id } })
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
          <CharactersMarkdownEditor
            novelId={novel.id}
            fetchCharactersMarkdown={fetchCharactersMarkdown}
            saveCharactersMarkdown={saveCharactersMarkdown}
            editCharacterSection={editCharacterSection}
            editCharacterDocument={editCharacterDocument}
            savingMarkdown={savingMarkdown}
            editingSection={editingSection}
            editingDocument={editingDocument}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {/* 左サイドバー: 目次 (カテゴリ / 人物) */}
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="shrink-0 border-r border-border bg-surface overflow-y-auto p-2 text-xs"
          >
            <div className="font-semibold text-muted-foreground px-2 py-1 mb-1">
              目次 (カテゴリ / 人物)
            </div>
            {characters.length === 0 ? (
              <div className="text-muted-foreground p-2 italic">人物が見つかりません</div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category} className="mb-2">
                  <button
                    type="button"
                    onClick={() => scrollToElement(`char-cat-${category}`)}
                    className="w-full text-left font-bold text-foreground px-2 py-1 bg-surface-raised rounded hover:bg-surface-hover transition truncate block"
                    title={category}
                  >
                    {category}
                  </button>
                  <div className="ml-2 mt-1 space-y-0.5">
                    {items.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => scrollToElement(`char-${ch.id}`)}
                        className="w-full text-left px-2 py-1 rounded truncate block text-foreground hover:bg-surface-raised hover:text-primary transition"
                        title={ch.name}
                      >
                        {ch.name}
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
            {loading && <Loading message="人物を読み込み中..." />}
            {!loading && characters.length === 0 && (
              <EmptyState
                title="人物が登録されていません"
                description="主人公や脇役を登録して、物語を豊かにしましょう。"
              />
            )}
            {!loading &&
              grouped.map(([category, items]) => (
                <section key={category} id={`char-cat-${category}`} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
                    <h3 className="text-sm font-bold text-foreground">{category}</h3>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                      {items.length}件
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((character) => (
                      <div key={character.id} id={`char-${character.id}`} className="scroll-mt-4">
                        <Card className="flex h-64 flex-col justify-between overflow-hidden">
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="shrink-0">
                              <CardHeader
                                title={character.name}
                                action={
                                  <div className="flex gap-1">
                                    <IconButton
                                      label="編集"
                                      onClick={() =>
                                        navigate({
                                          to: '/novels/$novelId/characters/$characterId',
                                          params: {
                                            novelId: novel.id,
                                            characterId: character.id,
                                          },
                                        })
                                      }
                                      icon={<PencilIcon />}
                                    />
                                    <IconButton
                                      label="削除"
                                      onClick={() => setDeletingId(character.id)}
                                      icon={<TrashIcon />}
                                    />
                                  </div>
                                }
                              />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-foreground-secondary">
                              <MarkdownText
                                content={character.description || '説明なし'}
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border">
                            {character.traits && character.traits.length > 0 ? (
                              character.traits.map((t) => <Tag key={t}>{t}</Tag>)
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                特徴なし
                              </span>
                            )}
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
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="人物を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}
