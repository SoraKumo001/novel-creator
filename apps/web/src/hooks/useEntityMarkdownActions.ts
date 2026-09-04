import {
  formatCharactersMarkdown,
  formatForeshadowingsMarkdown,
  formatPlotMarkdown,
  formatSettingsMarkdown,
  formatStoryOutlineMarkdown,
  formatTimelinesMarkdown,
} from "@novel-creator/shared";
import { type RefObject, useCallback, useEffect } from "react";
import { useChatUI } from "@/context/ChatContext.js";
import type { MonacoEditorInstance } from "@/hooks/useMarkdownEntityEditor.js";
import { useMarkdownExternalSync } from "@/hooks/useMarkdownExternalSync.js";
import { useToast } from "@/hooks/useToast.js";

export interface UseEntityMarkdownActionsOptions {
  /** カーソル位置に対応する現在のセクション（チャット相談先の解決用） */
  activeSection: { category: string; name: string } | null;
  /** 差分適用（外部同期）後に破棄するドラフト */
  clearDraft: () => void;
  /** Quota 溢れ等のドラフト保存エラー（toast 通知用） */
  draftError: string | null;
  editorRef: RefObject<MonacoEditorInstance | null>;
  entityTitle: string;
  entityType: string;
  /** 編集中の markdown */
  markdown: string;
  novelId: string;
  /** 永続化（作成/更新/削除件数を返す） */
  saveMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  /** 選択中テキスト（チャット相談用） */
  selectedText: string;
  setMarkdown: (markdown: string) => void;
  setSavedMarkdown: (markdown: string) => void;
}

export interface UseEntityMarkdownActionsReturn {
  /** 整形（エンティティ種別ごとのフォーマッタを適用） */
  handleFormat: () => void;
  /** 選択範囲/セクション/全体の優先順でチャット相談を開く */
  handleOpenChat: () => void;
  /** Monaco 標準の検索ウィジェットを開く */
  handleOpenFind: () => void;
  /** 履歴差分モーダルの復元内容をエディタへ適用する */
  handleRestoreSuccess: (restored: string) => void;
  /** 保存（件数トースト付き） */
  handleSave: () => Promise<void>;
}

/**
 * EntityMarkdownEditor の操作系（整形・保存・チャット相談・検索・差分適用）の切り出し。
 * チャット提案の外部同期購読とドラフトエラーの toast 通知もここに寄せる。
 * トースト文言・保存/Dirty 判定・イベント形状は変更しない。
 */
export function useEntityMarkdownActions({
  activeSection,
  clearDraft,
  draftError,
  editorRef,
  entityTitle,
  entityType,
  markdown,
  novelId,
  saveMarkdown,
  selectedText,
  setMarkdown,
  setSavedMarkdown,
}: UseEntityMarkdownActionsOptions): UseEntityMarkdownActionsReturn {
  const { openChat } = useChatUI();
  const toast = useToast();

  // Quota 溢れ時は握り潰さず toast で通知する（保存・Dirty 判定は不変）。
  useEffect(() => {
    if (draftError) {
      toast.error(draftError);
    }
  }, [draftError, toast]);

  // 差分適用責務: チャット提案の外部同期を購読する。
  useMarkdownExternalSync({
    novelId,
    entityTitle,
    entityType,
    setMarkdown,
    setSavedMarkdown,
    clearDraft,
  });

  const handleOpenChat = useCallback(() => {
    if (selectedText.trim()) {
      openChat(novelId, {
        entityType: "selection",
        title: `${entityTitle}（選択範囲）`,
        selectedText: selectedText.trim(),
      });
      return;
    }

    if (activeSection) {
      openChat(novelId, {
        entityType: "markdown_section",
        title: `${entityTitle}「${activeSection.name}」`,
        summary: `カテゴリー: ${activeSection.category}\n名前: ${activeSection.name}`,
      });
      return;
    }

    openChat(novelId, {
      entityType: "markdown_section",
      title: `${entityTitle}全体`,
      summary: markdown.slice(0, 500) + (markdown.length > 500 ? "…" : ""),
    });
  }, [activeSection, entityTitle, markdown, novelId, openChat, selectedText]);

  const handleFormat = useCallback(() => {
    let formatted = markdown;
    if (entityType === "characters_markdown") {
      formatted = formatCharactersMarkdown(markdown);
    } else if (entityType === "settings_markdown") {
      formatted = formatSettingsMarkdown(markdown);
    } else if (
      entityType === "foreshadowings_document" ||
      entityType === "foreshadowings_markdown"
    ) {
      formatted = formatForeshadowingsMarkdown(markdown);
    } else if (entityType === "story_outline_markdown") {
      formatted = formatStoryOutlineMarkdown(markdown);
    } else if (entityType === "plot_markdown") {
      formatted = formatPlotMarkdown(markdown);
    } else if (entityType === "timelines_markdown") {
      formatted = formatTimelinesMarkdown(markdown);
    }

    if (formatted === markdown) {
      toast.success("マークダウンはすでに整形されています");
      return;
    }

    setMarkdown(formatted);
    toast.success("マークダウンを整形しました");
  }, [entityType, markdown, setMarkdown, toast]);

  const handleSave = useCallback(async () => {
    try {
      const res = await saveMarkdown(markdown);
      setSavedMarkdown(markdown);
      clearDraft();
      if (
        res?.created !== undefined ||
        res?.updated !== undefined ||
        res?.deleted !== undefined
      ) {
        toast.success(
          `保存しました (作成: ${res.created ?? 0}件, 更新: ${res.updated ?? 0}件, 削除: ${res.deleted ?? 0}件)`
        );
      } else {
        toast.success("保存しました");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }, [clearDraft, markdown, saveMarkdown, setSavedMarkdown, toast]);

  // Monaco 標準の検索ウィジェットを開く（検索・置換）。
  const handleOpenFind = useCallback(() => {
    void editorRef.current?.getAction("actions.find")?.run();
  }, [editorRef]);

  // 差分適用責務: 履歴差分モーダルの復元内容をエディタへ適用する。
  const handleRestoreSuccess = useCallback(
    (restored: string) => {
      setMarkdown(restored);
      setSavedMarkdown(restored);
    },
    [setMarkdown, setSavedMarkdown]
  );

  return {
    handleFormat,
    handleOpenChat,
    handleOpenFind,
    handleRestoreSuccess,
    handleSave,
  };
}
