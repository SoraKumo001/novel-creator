import { useEffect } from "react";
import { useToast } from "@/hooks/useToast.js";

export interface UseMarkdownExternalSyncOptions {
  clearDraft: () => void;
  entityTitle: string;
  entityType: string;
  novelId: string;
  setMarkdown: (markdown: string) => void;
  setSavedMarkdown: (markdown: string) => void;
}

/**
 * チャット提案の差分適用（外部同期）責務の切り出し。
 * -MarkdownEditorCore からの移動（既存の import パスを維持するため
 * Core 側で再エクスポートする）。イベント名・ペイロード形状・
 * トースト文言は変更しない。
 */
export function useMarkdownExternalSync({
  novelId,
  entityTitle,
  entityType,
  setMarkdown,
  setSavedMarkdown,
  clearDraft,
}: UseMarkdownExternalSyncOptions): void {
  const toast = useToast();

  useEffect(() => {
    const eventNameMap: Record<string, string> = {
      characters_markdown: "novel-creator:characters-updated",
      settings_markdown: "novel-creator:settings-updated",
      foreshadowings_document: "novel-creator:foreshadowings-updated",
      foreshadowings_markdown: "novel-creator:foreshadowings-updated",
      story_outline_markdown: "novel-creator:story-outline-updated",
      timelines_markdown: "novel-creator:timelines-updated",
      plot_markdown: "novel-creator:plot-updated",
    };
    const targetEventName = eventNameMap[entityType];
    if (!targetEventName) {
      return;
    }
    const handleExternalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        appliedSection?: string;
        appliedTitle?: string;
        markdown: string;
        novelId: string;
      }>;
      if (!customEvent.detail || customEvent.detail.novelId !== novelId) {
        return;
      }
      const {
        markdown: newMarkdown,
        appliedSection,
        appliedTitle,
      } = customEvent.detail;
      setMarkdown(newMarkdown);
      setSavedMarkdown(newMarkdown);
      clearDraft();
      toast.success(
        `チャットからの提案（${appliedSection || appliedTitle || entityTitle}）をエディタに同期しました`
      );
    };
    window.addEventListener(targetEventName, handleExternalUpdate);
    return () => {
      window.removeEventListener(targetEventName, handleExternalUpdate);
    };
  }, [
    clearDraft,
    entityTitle,
    entityType,
    novelId,
    setMarkdown,
    setSavedMarkdown,
    toast,
  ]);

  useEffect(() => {
    const handlePreviewApply = (event: Event) => {
      const customEvent = event as CustomEvent<{
        novelId: string;
        entityType: string;
        markdown: string;
        appliedTitle?: string;
      }>;
      if (
        !customEvent.detail ||
        customEvent.detail.novelId !== novelId ||
        customEvent.detail.entityType !== entityType
      ) {
        return;
      }
      const { markdown: newMarkdown, appliedTitle } = customEvent.detail;
      setMarkdown(newMarkdown);
      toast.success(
        `チャットの提案内容（${appliedTitle || entityTitle}）をエディタに読み込みました。差分を確認・調整して保存してください。`
      );
    };
    window.addEventListener(
      "novel-creator:markdown-preview-apply",
      handlePreviewApply
    );
    return () => {
      window.removeEventListener(
        "novel-creator:markdown-preview-apply",
        handlePreviewApply
      );
    };
  }, [entityTitle, entityType, novelId, setMarkdown, toast]);
}
