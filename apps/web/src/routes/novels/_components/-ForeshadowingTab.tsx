import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useForeshadowings } from "@/hooks/useForeshadowings.js";
import { useNovel } from "@/hooks/useNovel.js";
import type { Foreshadowing, ForeshadowingStatus } from "@/lib/types.js";
import { EntityListTab } from "./-EntityListTab.js";
import { ForeshadowingsMarkdownEditor } from "./-ForeshadowingsMarkdownEditor.js";

interface ForeshadowingTabProps {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}

export type ForeshadowingEntity = Foreshadowing & {
  name: string;
  category: string;
};

const STATUS_CONFIG: Record<
  ForeshadowingStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  unresolved: {
    label: "未回収",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: "⏳",
  },
  resolved: {
    label: "回収済",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    icon: "✅",
  },
  abandoned: {
    label: "保留・破棄",
    bg: "bg-muted/10",
    text: "text-muted-foreground",
    border: "border-border",
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
    editForeshadowingSection,
    editForeshadowingDocument,
    savingMarkdown,
    editingSection,
    editingDocument,
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
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold text-xs transition hover:opacity-80 ${cfg.bg} ${cfg.text} ${cfg.border}`}
                  title="クリックしてステータスを変更"
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
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
          <ForeshadowingsMarkdownEditor
            novelId={novelId}
            fetchForeshadowingsMarkdown={fetchForeshadowingsMarkdown}
            saveForeshadowingsMarkdown={saveForeshadowingsMarkdown}
            editForeshadowingSection={editForeshadowingSection}
            editForeshadowingDocument={editForeshadowingDocument}
            savingMarkdown={savingMarkdown}
            editingSection={editingSection}
            editingDocument={editingDocument}
          />
        ),
        deleteTitle: "伏線を削除しますか？",
        deleteMessage: "この操作は元に戻せません。",
        deleteConfirmLabel: "削除",
      }}
    />
  );
}
