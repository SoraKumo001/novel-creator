import type { CategoryTreeNode } from "@novel-creator/shared";
import { Card, CardHeader } from "@/components/Card.js";
import { EmptyState } from "@/components/EmptyState.js";
import { IconButton, PencilIcon, TrashIcon } from "@/components/Icons.js";
import { Loading } from "@/components/Loading.js";

export interface EntityCardItem {
  id: string;
  name: string;
}

/** サイドバー用ツリーノード（EntityListTab から抽出・振る舞い維持） */
export function SidebarTreeNode<T extends EntityCardItem>({
  node,
  idPrefix,
  onScrollTo,
}: {
  idPrefix: string;
  node: CategoryTreeNode<T>;
  onScrollTo: (id: string) => void;
}) {
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

function BreadcrumbTitle({ fullPath }: { fullPath: string }) {
  const segments = fullPath.split(" / ");
  return (
    <h3 className="flex flex-wrap items-center gap-1.5 font-bold text-foreground text-sm">
      {segments.map((segment, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          {idx > 0 && (
            <span className="font-normal text-muted-foreground/60">›</span>
          )}
          <span
            className={
              idx === segments.length - 1
                ? "text-foreground"
                : "font-medium text-muted-foreground"
            }
          >
            {segment}
          </span>
        </span>
      ))}
    </h3>
  );
}

/** カードグリッド本体（振る舞い・DOM構造維持） */
export function EntityCardGrid<
  T extends { id: string; name: string; description: string | null },
>({
  flattenedSections,
  idPrefix,
  loading,
  loadingMessage,
  emptyTitle,
  emptyDescription,
  cardHeight,
  onEdit,
  onRequestDelete,
  renderCardBody,
  renderCardFooter,
}: {
  flattenedSections: { fullPath: string; items: T[] }[];
  idPrefix: string;
  loading: boolean;
  loadingMessage: string;
  emptyTitle: string;
  emptyDescription: string;
  cardHeight: string;
  onEdit: (entity: T) => void;
  onRequestDelete: (id: string) => void;
  renderCardBody: (entity: T) => React.ReactNode;
  renderCardFooter?: (entity: T) => React.ReactNode;
}) {
  return (
    <main className="@container min-h-0 flex-1 space-y-8 overflow-y-auto p-4">
      {loading && <Loading message={loadingMessage} />}
      {!loading && flattenedSections.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
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
              <BreadcrumbTitle fullPath={section.fullPath} />
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
                    className={`flex min-h-[14rem] ${cardHeight} flex-col justify-between overflow-hidden`}
                  >
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="shrink-0">
                        <CardHeader
                          title={entity.name}
                          action={
                            <div className="flex gap-1">
                              <IconButton
                                label="編集"
                                onClick={() => onEdit(entity)}
                                icon={<PencilIcon />}
                              />
                              <IconButton
                                label="削除"
                                onClick={() => onRequestDelete(entity.id)}
                                icon={<TrashIcon />}
                              />
                            </div>
                          }
                        />
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-foreground-secondary text-sm">
                        {renderCardBody(entity)}
                      </div>
                    </div>
                    {renderCardFooter && (
                      <div className="mt-2 flex shrink-0 flex-wrap gap-1.5 border-border border-t pt-2">
                        {renderCardFooter(entity)}
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}
