import {
  buildCategoryTree,
  type CategorySortOption,
  flattenCategoryTree,
} from "@novel-creator/shared";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { PlusIcon } from "@/components/Icons.js";
import { Select } from "@/components/Select.js";
import { TabHeader } from "@/components/TabHeader.js";
import { ViewModeSwitch } from "@/components/ViewModeSwitch.js";
import { EntityCardGrid, SidebarTreeNode } from "./-EntityListParts.js";
import {
  scrollToElementById,
  useOverlapHover,
  usePersistedState,
  useSidebarResize,
} from "./-MarkdownEditorCore.js";

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
  const [sidebarMode, setSidebarMode] = usePersistedState<"pinned" | "overlap">(
    `novel-creator:sidebar-mode:${config.idPrefix}`,
    "pinned"
  );
  const [sortOption, setSortOption] = usePersistedState<EntitySortOption>(
    `novel-creator:sort:${config.idPrefix}`,
    "category-asc-name-asc"
  );
  const { sidebarWidth, handleSplitterMouseDown } = useSidebarResize(256);
  const hover = useOverlapHover();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebarMode = () => {
    const next = sidebarMode === "pinned" ? "overlap" : "pinned";
    setSidebarMode(next);
    if (next === "overlap") {
      setIsSidebarOpen(false);
    }
  };

  const showOverlapSidebar =
    sidebarMode === "overlap" && (isSidebarOpen || hover.isHovered);

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
  };

  const categoryTree = useMemo(
    () => buildCategoryTree(entities, config.categoryOf, sortOption),
    [entities, config, sortOption]
  );

  const flattenedSections = useMemo(
    () => flattenCategoryTree(categoryTree).filter((s) => s.items.length > 0),
    [categoryTree]
  );

  async function handleDelete() {
    if (!deletingId) {
      return;
    }
    await onDelete(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  const { idPrefix } = config;
  const scrollToElement = (id: string) => scrollToElementById(id);

  return (
    <div className="flex h-full flex-col space-y-4">
      <TabHeader
        title={config.title}
        rightControls={
          viewMode === "cards" && (
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
          )
        }
        viewModeSwitch={
          <ViewModeSwitch
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: "カード", value: "cards" },
              { label: "マークダウン", value: "markdown" },
            ]}
          />
        }
      />

      {viewMode === "markdown" ? (
        <div className="min-h-0 flex-1">
          {config.renderMarkdownEditor(novelId)}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {sidebarMode === "pinned" && (
            <>
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="shrink-0 overflow-y-auto border-border border-r bg-surface p-2 text-xs"
              >
                <SidebarHeader
                  sidebarLabel={config.sidebarLabel}
                  onFloat={toggleSidebarMode}
                />
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
              <div
                onMouseDown={handleSplitterMouseDown}
                className="z-10 -ml-0.5 w-1.5 shrink-0 cursor-col-resize select-none bg-border transition-colors hover:w-2 hover:bg-primary/50"
                title="ドラッグして幅を調整"
              />
            </>
          )}

          {sidebarMode === "overlap" && (
            <div
              onMouseEnter={hover.handleMouseEnter}
              onMouseLeave={hover.handleMouseLeave}
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

          {showOverlapSidebar && (
            <div
              onMouseEnter={hover.handleMouseEnter}
              onMouseLeave={hover.handleMouseLeave}
              className="absolute top-0 bottom-0 left-7 z-30 flex shadow-2xl"
            >
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="slide-in-from-left flex animate-in flex-col overflow-y-auto border-border border-r bg-surface/98 p-2 text-xs backdrop-blur-md duration-150"
              >
                <SidebarHeader
                  sidebarLabel={config.sidebarLabel}
                  onPin={toggleSidebarMode}
                />
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

          <EntityCardGrid
            flattenedSections={flattenedSections}
            idPrefix={idPrefix}
            loading={loading}
            loadingMessage={config.loadingMessage}
            emptyTitle={config.emptyTitle}
            emptyDescription={config.emptyDescription}
            cardHeight={config.cardHeight}
            onEdit={config.onEdit}
            onRequestDelete={setDeletingId}
            renderCardBody={config.renderCardBody}
            renderCardFooter={config.renderCardFooter}
          />
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

function SidebarHeader({
  sidebarLabel,
  onFloat,
  onPin,
}: {
  sidebarLabel: string;
  onFloat?: () => void;
  onPin?: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between border-border border-b px-1 pb-1.5 font-semibold text-muted-foreground">
      <span className="truncate font-bold text-foreground" title={sidebarLabel}>
        目次
      </span>
      {onFloat && (
        <button
          type="button"
          onClick={onFloat}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
          title="フロート表示にする（表示領域を節約）"
          aria-label="フロート表示"
        >
          🪟
        </button>
      )}
      {onPin && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onPin}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
            title="固定表示にする"
            aria-label="固定表示"
          >
            📌
          </button>
        </div>
      )}
    </div>
  );
}
