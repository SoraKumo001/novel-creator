import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Badge, type BadgeVariant } from "@/components/Badge.js";
import { MarkdownText } from "@/components/MarkdownText.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useForeshadowings } from "@/hooks/useForeshadowings.js";
import { type NovelMutations, useNovel } from "@/hooks/useNovel.js";
import type { Foreshadowing, ForeshadowingStatus } from "@/lib/types.js";
import { EntityListTab } from "./-EntityListTab.js";
import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

interface ForeshadowingTabProps {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  novelMutations?: NovelMutations;
  onRefresh: () => Promise<void>;
}

export type ForeshadowingEntity = Foreshadowing & {
  name: string;
  category: string;
};

const STATUS_CONFIG: Record<
  ForeshadowingStatus,
  { label: string; variant: BadgeVariant; icon: string }
> = {
  unresolved: {
    label: "未回収",
    variant: "amber",
    icon: "⏳",
  },
  resolved: {
    label: "回収済",
    variant: "emerald",
    icon: "✅",
  },
  abandoned: {
    label: "保留・破棄",
    variant: "muted",
    icon: "🚫",
  },
};

export function ForeshadowingTab({ novel, onRefresh }: ForeshadowingTabProps) {
  const {
    foreshadowings,
    loading,
    deleteForeshadowing,
    updateForeshadowing,
    deleting,
    fetchForeshadowingsMarkdown,
    saveForeshadowingsMarkdown,
    savingMarkdown,
  } = useForeshadowings(novel.id);
  const { chapters } = useChapters(novel.id);
  const navigate = useNavigate();

  // 節IDから名前を取得するマップ
  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of chapters) {
      for (const sec of ch.sections) {
        map.set(sec.id, `${ch.title} > ${sec.title || `節 ${sec.order}`}`);
      }
    }
    return map;
  }, [chapters]);

  const entities: ForeshadowingEntity[] = useMemo(
    () =>
      foreshadowings.map((f) => ({
        ...f,
        name: f.title,
        category: f.category || "未分類",
      })),
    [foreshadowings]
  );

  const handleToggleStatus = async (item: ForeshadowingEntity) => {
    const nextStatus: ForeshadowingStatus =
      item.status === "unresolved"
        ? "resolved"
        : item.status === "resolved"
          ? "abandoned"
          : "unresolved";
    await updateForeshadowing(item.id, { status: nextStatus });
    await onRefresh();
  };

  return (
    <EntityListTab<ForeshadowingEntity>
      novelId={novel.id}
      onRefresh={onRefresh}
      entities={entities}
      loading={loading}
      deleting={deleting}
      onDelete={deleteForeshadowing}
      config={{
        title: "伏線・フラグ管理",
        newLabel: "新規作成",
        sidebarLabel: "目次 (カテゴリ / 伏線)",
        sidebarEmpty: "伏線がありません",
        loadingMessage: "伏線を読み込み中...",
        emptyTitle: "伏線がありません",
        emptyDescription:
          "作中の伏線やフラグ、回収予定の謎などを登録しましょう。",
        idPrefix: "foreshadowing",
        cardHeight: "h-64",
        categoryOf: (f) => f.category,
        onNew: () =>
          navigate({
            to: "/novels/$novelId/foreshadowings/new",
            params: { novelId: novel.id },
          }),
        onEdit: (f) =>
          navigate({
            to: "/novels/$novelId/foreshadowings/$foreshadowingId",
            params: { novelId: novel.id, foreshadowingId: f.id },
          }),
        renderCardBody: (item) => {
          const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unresolved;
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleStatus(item);
                  }}
                  className="cursor-pointer transition hover:opacity-80"
                  title="クリックしてステータスを変更"
                >
                  <Badge variant={cfg.variant} icon={cfg.icon}>
                    {cfg.label}
                  </Badge>
                </button>
              </div>

              {(item.placedSectionId || item.resolvedSectionId) && (
                <div className="space-y-1 text-muted-foreground text-xs">
                  {item.placedSectionId && (
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 font-medium text-foreground-secondary">
                        設置:
                      </span>
                      <span className="truncate">
                        {sectionMap.get(item.placedSectionId) ?? "不明な節"}
                      </span>
                    </div>
                  )}
                  {item.resolvedSectionId && (
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                        回収:
                      </span>
                      <span className="truncate">
                        {sectionMap.get(item.resolvedSectionId) ?? "不明な節"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <MarkdownText
                content={item.description || "詳細メモなし"}
                className="line-clamp-3 text-sm"
              />
            </div>
          );
        },
        renderMarkdownEditor: (novelId) => (
          <PresetEntityMarkdownEditor
            preset="foreshadowings"
            novelId={novelId}
            fetchMarkdown={fetchForeshadowingsMarkdown}
            saveMarkdown={saveForeshadowingsMarkdown}
            savingMarkdown={savingMarkdown}
          />
        ),
        deleteTitle: "伏線を削除しますか？",
        deleteMessage: "この操作は元に戻せません。",
        deleteConfirmLabel: "削除",
      }}
    />
  );
}
