import { useNavigate } from "@tanstack/react-router";
import { MarkdownText } from "@/components/MarkdownText.js";
import { useNovel } from "@/hooks/useNovel.js";
import { useSettings } from "@/hooks/useSettings.js";
import type { Setting } from "@/lib/types.js";
import { EntityListTab } from "./-EntityListTab.js";
import { SettingsMarkdownEditor } from "./-SettingsMarkdownEditor.js";

export function SettingsTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  const {
    settings,
    loading,
    deleteSetting,
    deleting,
    fetchSettingsMarkdown,
    saveSettingsMarkdown,
    savingMarkdown,
  } = useSettings(novel.id);
  const navigate = useNavigate();

  return (
    <EntityListTab<Setting>
      novelId={novel.id}
      onRefresh={onRefresh}
      entities={settings}
      loading={loading}
      deleting={deleting}
      onDelete={deleteSetting}
      config={{
        title: "設定一覧",
        newLabel: "新規作成",
        sidebarLabel: "目次 (カテゴリ / 設定)",
        sidebarEmpty: "設定がありません",
        loadingMessage: "設定を読み込み中...",
        emptyTitle: "設定がありません",
        emptyDescription: "世界観や魔法体系などを登録しましょう。",
        idPrefix: "setting",
        cardHeight: "h-56",
        categoryOf: (s) => s.category,
        onNew: () =>
          navigate({
            to: "/novels/$novelId/settings/new",
            params: { novelId: novel.id },
          }),
        onEdit: (setting) =>
          navigate({
            to: "/novels/$novelId/settings/$settingId",
            params: { novelId: novel.id, settingId: setting.id },
          }),
        renderCardBody: (setting) => (
          <MarkdownText
            content={setting.description || "説明なし"}
            className="text-sm"
          />
        ),
        renderMarkdownEditor: (novelId) => (
          <SettingsMarkdownEditor
            novelId={novelId}
            fetchSettingsMarkdown={fetchSettingsMarkdown}
            saveSettingsMarkdown={saveSettingsMarkdown}
            savingMarkdown={savingMarkdown}
          />
        ),
        deleteTitle: "設定を削除しますか？",
        deleteMessage: "この操作は元に戻せません。",
        deleteConfirmLabel: "削除",
      }}
    />
  );
}
