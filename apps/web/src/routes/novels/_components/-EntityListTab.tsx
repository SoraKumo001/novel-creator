import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Loading } from '@/components/Loading.js';
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from './-Icons.js';

export interface EntityListTabConfig<
  T extends { id: string; name: string; category: string; description: string | null },
> {
  title: string;
  newLabel: string;
  sidebarLabel: string;
  sidebarEmpty: string;
  loadingMessage: string;
  emptyTitle: string;
  emptyDescription: string;
  idPrefix: string;
  cardHeight: string;
  categoryOf: (entity: T) => string;
  onNew: () => void;
  onEdit: (entity: T) => void;
  renderCardBody: (entity: T) => ReactNode;
  renderCardFooter?: (entity: T) => ReactNode;
  renderMarkdownEditor: (novelId: string) => ReactNode;
  deleteTitle: string;
  deleteMessage: string;
  deleteConfirmLabel: string;
}

export type EntitySortOption =
  | 'category-asc-name-asc'
  | 'category-asc-name-desc'
  | 'category-desc-name-asc'
  | 'category-desc-name-desc'
  | 'name-asc'
  | 'name-desc';

export function EntityListTab<
  T extends { id: string; name: string; category: string; description: string | null },
>({
  novelId,
  onRefresh,
  entities,
  loading,
  deleting,
  onDelete,
  config,
}: {
  novelId: string;
  onRefresh: () => Promise<void>;
  entities: T[];
  loading: boolean;
  deleting: boolean;
  onDelete: (id: string) => Promise<void>;
  config: EntityListTabConfig<T>;
}) {
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sortOption, setSortOption] = useState<EntitySortOption>(() => {
    const saved = localStorage.getItem(`novel-creator:sort:${config.idPrefix}`);
    return (saved as EntitySortOption) || 'category-asc-name-asc';
  });

  const handleSortChange = (newSort: EntitySortOption) => {
    setSortOption(newSort);
    localStorage.setItem(`novel-creator:sort:${config.idPrefix}`, newSort);
  };

  const isDraggingRef = useRef(false);

  const grouped = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const entity of entities) {
      const cat = config.categoryOf(entity) || '未分類';
      const list = map.get(cat) ?? [];
      list.push(entity);
      map.set(cat, list);
    }

    // カテゴリ内のアイテムをソート
    for (const [_, items] of map.entries()) {
      items.sort((a, b) => {
        if (sortOption.endsWith('desc')) {
          return b.name.localeCompare(a.name, 'ja');
        }
        return a.name.localeCompare(b.name, 'ja');
      });
    }

    // カテゴリ自体のソート
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      if (sortOption.startsWith('category-desc')) {
        return b[0].localeCompare(a[0], 'ja');
      }
      return a[0].localeCompare(b[0], 'ja');
    });

    return entries;
  }, [entities, config, sortOption]);

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
    await onDelete(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  const { idPrefix } = config;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
        <h2 className="text-xl font-bold text-foreground">{config.title}</h2>
        <div className="flex items-center gap-3">
          {viewMode === 'cards' && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>並び順:</span>
                <select
                  aria-label="並び順"
                  value={sortOption}
                  onChange={(e) => handleSortChange(e.target.value as EntitySortOption)}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="category-asc-name-asc">カテゴリ昇順・名前昇順</option>
                  <option value="category-asc-name-desc">カテゴリ昇順・名前降順</option>
                  <option value="category-desc-name-asc">カテゴリ降順・名前昇順</option>
                  <option value="category-desc-name-desc">カテゴリ降順・名前降順</option>
                  <option value="name-asc">名前昇順 (あ→ん)</option>
                  <option value="name-desc">名前降順 (ん→あ)</option>
                </select>
              </div>

              <Button onClick={config.onNew} leftIcon={<PlusIcon />}>
                {config.newLabel}
              </Button>
            </>
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
        <div className="min-h-0 flex-1">{config.renderMarkdownEditor(novelId)}</div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {/* 左サイドバー: 目次 (カテゴリ / 人物) */}
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="shrink-0 border-r border-border bg-surface overflow-y-auto p-2 text-xs"
          >
            <div className="font-semibold text-muted-foreground px-2 py-1 mb-1">
              {config.sidebarLabel}
            </div>
            {entities.length === 0 ? (
              <div className="text-muted-foreground p-2 italic">{config.sidebarEmpty}</div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category} className="mb-2">
                  <button
                    type="button"
                    onClick={() => scrollToElement(`${idPrefix}-cat-${category}`)}
                    className="w-full text-left font-bold text-foreground px-2 py-1 bg-surface-raised rounded hover:bg-surface-hover transition truncate block"
                    title={category}
                  >
                    {category}
                  </button>
                  <div className="ml-2 mt-1 space-y-0.5">
                    {items.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => scrollToElement(`${idPrefix}-${entity.id}`)}
                        className="w-full text-left px-2 py-1 rounded truncate block text-foreground hover:bg-surface-raised hover:text-primary transition"
                        title={entity.name}
                      >
                        {entity.name}
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
            {loading && <Loading message={config.loadingMessage} />}
            {!loading && entities.length === 0 && (
              <EmptyState title={config.emptyTitle} description={config.emptyDescription} />
            )}
            {!loading &&
              grouped.map(([category, items]) => (
                <section key={category} id={`${idPrefix}-cat-${category}`} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
                    <h3 className="text-sm font-bold text-foreground">{category}</h3>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                      {items.length}件
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((entity) => (
                      <div key={entity.id} id={`${idPrefix}-${entity.id}`} className="scroll-mt-4">
                        <Card
                          className={`flex ${config.cardHeight} flex-col justify-between overflow-hidden`}
                        >
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="shrink-0">
                              <CardHeader
                                title={entity.name}
                                action={
                                  <div className="flex gap-1">
                                    <IconButton
                                      label="編集"
                                      onClick={() => config.onEdit(entity)}
                                      icon={<PencilIcon />}
                                    />
                                    <IconButton
                                      label="削除"
                                      onClick={() => setDeletingId(entity.id)}
                                      icon={<TrashIcon />}
                                    />
                                  </div>
                                }
                              />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-foreground-secondary">
                              {config.renderCardBody(entity)}
                            </div>
                          </div>
                          {config.renderCardFooter && (
                            <div className="shrink-0 flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border">
                              {config.renderCardFooter(entity)}
                            </div>
                          )}
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
        title={config.deleteTitle}
        message={config.deleteMessage}
        confirmLabel={config.deleteConfirmLabel}
        isLoading={deleting}
      />
    </div>
  );
}
