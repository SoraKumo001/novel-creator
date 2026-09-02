import {
  buildCategoryTree,
  type CategorySortOption,
  type CategoryTreeNode,
  flattenCategoryTree,
} from "@novel-creator/shared";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/Button.js";
import { Card, CardHeader } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { EmptyState } from "@/components/EmptyState.js";
import { Loading } from "@/components/Loading.js";
import { Select } from "@/components/Select.js";
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from "./-Icons.js";

export interface EntityListTabConfig<
  T extends {
    id: string;
    name: string;
    category: string;
    description: string | null;
  },
> {
  cardHeight: string;
  categoryOf: (entity: T) => string;
  deleteConfirmLabel: string;
  deleteMessage: string;
  deleteTitle: string;
  emptyDescription: string;
  emptyTitle: string;
  idPrefix: string;
  loadingMessage: string;
  newLabel: string;
  onEdit: (entity: T) => void;
  onNew: () => void;
  renderCardBody: (entity: T) => ReactNode;
  renderCardFooter?: (entity: T) => ReactNode;
  renderMarkdownEditor: (novelId: string) => ReactNode;
  sidebarEmpty: string;
  sidebarLabel: string;
  title: string;
}

export type EntitySortOption = CategorySortOption;

export function EntityListTab<
  T extends {
    id: string;
    name: string;
    category: string;
    description: string | null;
  },
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
  const [viewMode, setViewMode] = useState<"cards" | "markdown">("cards");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarMode, setSidebarMode] = useState<"pinned" | "overlap">(() => {
    const saved = localStorage.getItem(
      `novel-creator:sidebar-mode:${config.idPrefix}`
    );
    return saved === "overlap" ? "overlap" : "pinned";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sortOption, setSortOption] = useState<EntitySortOption>(() => {
    const saved = localStorage.getItem(`novel-creator:sort:${config.idPrefix}`);
    return (saved as EntitySortOption) || "category-asc-name-asc";
  });

  const toggleSidebarMode = () => {
    const next = sidebarMode === "pinned" ? "overlap" : "pinned";
    setSidebarMode(next);
    localStorage.setItem(`novel-creator:sidebar-mode:${config.idPrefix}`, next);
    if (next === "overlap") {
      setIsSidebarOpen(false);
    }
  };

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsSidebarOpen(false);
    }, 250);
  }, []);

  const showOverlapSidebar =
    sidebarMode === "overlap" && (isSidebarOpen || isHovered);

  // チャット等からMarkdown編集画面へ遷移要求があった場合にviewModeをmarkdownに切り替える
  useEffect(() => {
    const handleSwitch = () => {
      setViewMode("markdown");
    };
    window.addEventListener(
      "novel-creator:markdown-preview-apply",
      handleSwitch
    );
    return () => {
      window.removeEventListener(
        "novel-creator:markdown-preview-apply",
        handleSwitch
      );
    };
  }, []);

  const handleSortChange = (newSort: EntitySortOption) => {
    setSortOption(newSort);
    localStorage.setItem(`novel-creator:sort:${config.idPrefix}`, newSort);
  };

  const isDraggingRef = useRef(false);

  const categoryTree = useMemo(
    () => buildCategoryTree(entities, config.categoryOf, sortOption),
    [entities, config, sortOption]
  );

  const flattenedSections = useMemo(
    () => flattenCategoryTree(categoryTree).filter((s) => s.items.length > 0),
    [categoryTree]
  );

  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(500, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  async function handleDelete() {
    if (!deletingId) {
      return;
    }
    await onDelete(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  const { idPrefix } = config;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-border border-b pb-3">
        <h2 className="font-bold text-foreground text-xl">{config.title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "cards" && (
            <>
              <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                <span>並び順:</span>
                <Select
                  aria-label="並び順"
                  value={sortOption}
                  onChange={(e) =>
                    handleSortChange(e.target.value as EntitySortOption)
                  }
                  className="px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="category-asc-name-asc">
                    カテゴリ昇順・名前昇順
                  </option>
                  <option value="category-asc-name-desc">
                    カテゴリ昇順・名前降順
                  </option>
                  <option value="category-desc-name-asc">
                    カテゴリ降順・名前昇順
                  </option>
                  <option value="category-desc-name-desc">
                    カテゴリ降順・名前降順
                  </option>
                  <option value="name-asc">名前昇順 (あ→ん)</option>
                  <option value="name-desc">名前降順 (ん→あ)</option>
                </Select>
              </div>

              <Button
                onClick={config.onNew}
                leftIcon={<PlusIcon />}
                className="shrink-0 whitespace-nowrap"
              >
                {config.newLabel}
              </Button>
            </>
          )}
          <div className="flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded-md px-3 py-1.5 font-medium text-sm transition ${
                viewMode === "cards"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setViewMode("markdown")}
              className={`rounded-md px-3 py-1.5 font-medium text-sm transition ${
                viewMode === "markdown"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              マークダウン編集
            </button>
          </div>
        </div>
      </div>

      {viewMode === "markdown" ? (
        <div className="min-h-0 flex-1">
          {config.renderMarkdownEditor(novelId)}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {/* 左サイドバー (固定モード) */}
          {sidebarMode === "pinned" && (
            <>
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="shrink-0 overflow-y-auto border-border border-r bg-surface p-2 text-xs"
              >
                <div className="mb-2 flex items-center justify-between border-border border-b px-1 pb-1.5 font-semibold text-muted-foreground">
                  <span
                    className="truncate font-bold text-foreground"
                    title={config.sidebarLabel}
                  >
                    目次
                  </span>
                  <button
                    type="button"
                    onClick={toggleSidebarMode}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
                    title="フロート表示にする（表示領域を節約）"
                    aria-label="フロート表示"
                  >
                    🪟
                  </button>
                </div>
                {entities.length === 0 ? (
                  <div className="p-2 text-muted-foreground italic">
                    {config.sidebarEmpty}
                  </div>
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
                className="z-10 -ml-0.5 w-1.5 shrink-0 cursor-col-resize select-none bg-border transition-colors hover:w-2 hover:bg-primary/50"
                title="ドラッグして幅を調整"
              />
            </>
          )}

          {/* 左サイドバー (オーバーラップモード - 縮小ストリップ) */}
          {sidebarMode === "overlap" && (
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="group z-10 flex w-7 shrink-0 cursor-pointer flex-col items-center border-border border-r bg-surface/80 py-3 text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
              title="マウスホバーで目次を展開"
            >
              <span className="text-xs">📑</span>
              <span className="mt-2 font-medium text-[10px] tracking-widest opacity-70 [writing-mode:vertical-rl] group-hover:opacity-100">
                目次
              </span>
            </div>
          )}

          {/* 左サイドバー (オーバーラップモード - 展開パネル) */}
          {showOverlapSidebar && (
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="absolute top-0 bottom-0 left-7 z-30 flex shadow-2xl"
            >
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="slide-in-from-left flex animate-in flex-col overflow-y-auto border-border border-r bg-surface/98 p-2 text-xs backdrop-blur-md duration-150"
              >
                <div className="mb-2 flex items-center justify-between border-border border-b px-1 pb-1.5 font-semibold text-muted-foreground">
                  <span
                    className="truncate font-bold text-foreground"
                    title={config.sidebarLabel}
                  >
                    目次
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={toggleSidebarMode}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
                      title="固定表示にする"
                      aria-label="固定表示"
                    >
                      📌
                    </button>
                  </div>
                </div>
                {entities.length === 0 ? (
                  <div className="p-2 text-muted-foreground italic">
                    {config.sidebarEmpty}
                  </div>
                ) : (
                  categoryTree.map((node) => (
                    <SidebarTreeNode
                      key={node.fullPath}
                      node={node}
                      idPrefix={idPrefix}
                      onScrollTo={(id) => {
                        scrollToElement(id);
                        setIsSidebarOpen(false);
                      }}
                    />
                  ))
                )}
              </aside>
            </div>
          )}

          {/* 右メイン領域: カードグリッド */}
          <main className="@container min-h-0 flex-1 space-y-8 overflow-y-auto p-4">
            {loading && <Loading message={config.loadingMessage} />}
            {!loading && entities.length === 0 && (
              <EmptyState
                title={config.emptyTitle}
                description={config.emptyDescription}
              />
            )}
            {!loading &&
              flattenedSections.map((section) => (
                <section
                  key={section.fullPath}
                  id={`${idPrefix}-cat-${encodeURIComponent(section.fullPath)}`}
                  className="scroll-mt-4 space-y-3"
                >
                  <div className="flex items-center gap-2 border-border border-b pb-2">
                    <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
                    <h3 className="flex flex-wrap items-center gap-1.5 font-bold text-foreground text-sm">
                      {section.fullPath
                        .split(" / ")
                        .map((segment, idx, arr) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            {idx > 0 && (
                              <span className="font-normal text-muted-foreground/60">
                                ›
                              </span>
                            )}
                            <span
                              className={
                                idx === arr.length - 1
                                  ? "text-foreground"
                                  : "font-medium text-muted-foreground"
                              }
                            >
                              {segment}
                            </span>
                          </span>
                        ))}
                    </h3>
                    <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 font-semibold text-[11px] text-muted-foreground">
                      {section.items.length}件
                    </span>
                  </div>
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
                    {section.items.map((entity) => (
                      <div
                        key={entity.id}
                        id={`${idPrefix}-${entity.id}`}
                        className="scroll-mt-4"
                      >
                        <Card
                          className={`flex min-h-[14rem] ${config.cardHeight} flex-col justify-between overflow-hidden`}
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
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-foreground-secondary text-sm">
                              {config.renderCardBody(entity)}
                            </div>
                          </div>
                          {config.renderCardFooter && (
                            <div className="mt-2 flex shrink-0 flex-wrap gap-1.5 border-border border-t pt-2">
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
  idPrefix: string;
  node: CategoryTreeNode<T>;
  onScrollTo: (id: string) => void;
}

function SidebarTreeNode<T extends { id: string; name: string }>({
  node,
  idPrefix,
  onScrollTo,
}: SidebarTreeNodeProps<T>) {
  const isRoot = node.level === 0;

  return (
    <div
      className={isRoot ? "mb-2" : "mt-0.5 border-border/70 border-l pl-2.5"}
    >
      <button
        type="button"
        onClick={() =>
          onScrollTo(`${idPrefix}-cat-${encodeURIComponent(node.fullPath)}`)
        }
        className={`block flex w-full items-center justify-between gap-1.5 truncate rounded px-2 py-1 text-left transition ${
          isRoot
            ? "bg-surface-raised font-bold text-foreground text-xs hover:bg-surface-hover"
            : "font-semibold text-[11px] text-foreground/80 hover:bg-surface-raised hover:text-foreground"
        }`}
        title={node.fullPath}
      >
        <span className="truncate">{node.name}</span>
        <span className="shrink-0 font-normal text-[10px] text-muted-foreground">
          {node.totalCount}
        </span>
      </button>

      {/* 直属のアイテム */}
      {node.items.length > 0 && (
        <div className="mt-0.5 ml-1.5 space-y-0.5">
          {node.items.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => onScrollTo(`${idPrefix}-${entity.id}`)}
              className="block w-full truncate rounded px-2 py-0.5 text-left text-[11px] text-foreground-secondary transition hover:bg-surface-raised hover:text-primary"
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
