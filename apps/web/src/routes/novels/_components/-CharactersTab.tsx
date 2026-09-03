import { useNavigate } from "@tanstack/react-router";
import { MarkdownText } from "@/components/MarkdownText.js";
import { Tag } from "@/components/Tag.js";
import { useCharacters } from "@/hooks/useCharacters.js";
import { useNovel } from "@/hooks/useNovel.js";
import type { Character } from "@/lib/types.js";
import { EntityListTab } from "./-EntityListTab.js";
import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

export function CharactersTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  const {
    characters,
    loading,
    deleteCharacter,
    fetchCharactersMarkdown,
    saveCharactersMarkdown,
    deleting,
    savingMarkdown,
  } = useCharacters(novel.id);
  const navigate = useNavigate();

  return (
    <EntityListTab<Character>
      novelId={novel.id}
      onRefresh={onRefresh}
      entities={characters}
      loading={loading}
      deleting={deleting}
      onDelete={deleteCharacter}
      config={{
        title: "人物一覧",
        newLabel: "新規作成",
        sidebarLabel: "目次 (カテゴリ / 人物)",
        sidebarEmpty: "人物が見つかりません",
        loadingMessage: "人物を読み込み中...",
        emptyTitle: "人物が登録されていません",
        emptyDescription: "主人公や脇役を登録して、物語を豊かにしましょう。",
        idPrefix: "char",
        cardHeight: "h-64",
        categoryOf: (c) => c.category || "未分類",
        onNew: () =>
          navigate({
            to: "/novels/$novelId/characters/new",
            params: { novelId: novel.id },
          }),
        onEdit: (character) =>
          navigate({
            to: "/novels/$novelId/characters/$characterId",
            params: { novelId: novel.id, characterId: character.id },
          }),
        renderCardBody: (character) => (
          <MarkdownText
            content={character.description || "説明なし"}
            className="text-sm"
          />
        ),
        renderCardFooter: (character) =>
          character.traits && character.traits.length > 0 ? (
            character.traits.map((t) => <Tag key={t}>{t}</Tag>)
          ) : (
            <span className="text-[11px] text-muted-foreground italic">
              特徴なし
            </span>
          ),
        renderMarkdownEditor: (novelId) => (
          <PresetEntityMarkdownEditor
            preset="characters"
            novelId={novelId}
            fetchMarkdown={fetchCharactersMarkdown}
            saveMarkdown={saveCharactersMarkdown}
            savingMarkdown={savingMarkdown}
          />
        ),
        deleteTitle: "人物を削除しますか？",
        deleteMessage: "この操作は元に戻せません。",
        deleteConfirmLabel: "削除",
      }}
    />
  );
}
