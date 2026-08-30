import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildCategoryTree,
  flattenCategoryTree,
  type CategorySortOption,
  type CategoryTreeNode,
} from '@novel-creator/shared';
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

export type EntitySortOption = CategorySortOption;

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

  const categoryTree = useMemo(() => {
    return buildCategoryTree(entities, config.categoryOf, sortOption);
  }, [entities, config, sortOption]);

  const flattenedSections = useMemo(() => {
    return flattenCategoryTree(categoryTree).filter((s) => s.items.length > 0);
  }, [categoryTree]);

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
              categoryTree.map((node) => (
                <SidebarTreeNode
                  key={node.fullPath}
                  node={node}
                  idPrefix={idPrefix}
                  onScrollTo={scrollToElement}
                />
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
              flattenedSections.map((section) => (
                <section
                  key={section.fullPath}
                  id={`${idPrefix}-cat-${encodeURIComponent(section.fullPath)}`}
                  className="space-y-3 scroll-mt-4"
                >
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                      {section.fullPath.split(' / ').map((segment, idx, arr) => (
                        <span key={idx} className="flex items-center gap-1.5">
                          {idx > 0 && (
                            <span className="text-muted-foreground/60 font-normal">›</span>
                          )}
                          <span
                            className={
                              idx === arr.length - 1
                                ? 'text-foreground'
                                : 'text-muted-foreground font-medium'
                            }
                          >
                            {segment}
                          </span>
                        </span>
                      ))}
                    </h3>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                      {section.items.length}件
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((entity) => (
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

interface SidebarTreeNodeProps<T extends { id: string; name: string }> {
  node: CategoryTreeNode<T>;
  idPrefix: string;
  onScrollTo: (id: string) => void;
}

function SidebarTreeNode<T extends { id: string; name: string }>({
  node,
  idPrefix,
  onScrollTo,
}: SidebarTreeNodeProps<T>) {
  const isRoot = node.level === 0;

  return (
    <div className={isRoot ? 'mb-2' : 'mt-0.5 pl-2.5 border-l border-border/70'}>
      <button
        type="button"
        onClick={() => onScrollTo(`${idPrefix}-cat-${encodeURIComponent(node.fullPath)}`)}
        className={`w-full text-left rounded px-2 py-1 truncate block transition flex items-center justify-between gap-1.5 ${
          isRoot
            ? 'font-bold text-foreground bg-surface-raised hover:bg-surface-hover text-xs'
            : 'font-semibold text-foreground/80 hover:bg-surface-raised hover:text-foreground text-[11px]'
        }`}
        title={node.fullPath}
      >
        <span className="truncate">{node.name}</span>
        <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
          {node.totalCount}
        </span>
      </button>

      {/* 直属のアイテム */}
      {node.items.length > 0 && (
        <div className="ml-1.5 mt-0.5 space-y-0.5">
          {node.items.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => onScrollTo(`${idPrefix}-${entity.id}`)}
              className="w-full text-left px-2 py-0.5 rounded truncate block text-[11px] text-foreground-secondary hover:bg-surface-raised hover:text-primary transition"
              title={entity.name}
            >
              {entity.name}
            </button>
          ))}
        </div>
      )}

      {/* 子カテゴリ */}
      {node.children.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.fullPath}
              node={child}
              idPrefix={idPrefix}
              onScrollTo={onScrollTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
