import {
  formatCharactersMarkdown,
  formatForeshadowingsMarkdown,
  formatPlotMarkdown,
  formatSettingsMarkdown,
  formatStoryOutlineMarkdown,
  formatTimelinesMarkdown,
  type MarkdownCategoryNode,
} from "@novel-creator/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { HistoryDiffModal } from "@/components/HistoryDiffModal.js";
import { Loading } from "@/components/Loading.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useMarkdownEntityEditor } from "@/hooks/useMarkdownEntityEditor.js";
import { useToast } from "@/hooks/useToast.js";
import {
  EditorSidebarShell,
  MarkdownDraftBanner,
  MarkdownTocNav,
  MarkdownToolbarRow,
  SelectionConsultBar,
  TocHeader,
  TocToggleButton,
  useEditorSaveShortcut,
  useMarkdownExternalSync,
  useOverlapHover,
} from "./-MarkdownEditorCore.js";
import { MonacoEditor } from "./-MonacoEditor.js";

export interface EntityMarkdownEditorProps<
  TSection extends { category: string; name: string },
> {
  buildTree: (markdown: string) => MarkdownCategoryNode[];
  entityTitle: string;
  entityType:
    | "characters_markdown"
    | "settings_markdown"
    | "foreshadowings_document"
    | "foreshadowings_markdown"
    | "story_outline_markdown"
    | "timelines_markdown"
    | "plot_markdown";
  extraToolbarActions?: React.ReactNode;
  fetchMarkdown: () => Promise<string>;
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
  novelId: string;
  saveMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  savingMarkdown: boolean;
  storageKey: string;
}

export function EntityMarkdownEditor<
  TSection extends { category: string; name: string },
>({
  novelId,
  entityTitle,
  entityType,
  storageKey,
  fetchMarkdown,
  saveMarkdown,
  buildTree,
  findSectionAtLine,
  savingMarkdown,
  extraToolbarActions,
}: EntityMarkdownEditorProps<TSection>) {
  const {
    markdown,
    setMarkdown,
    setSavedMarkdown,
    loading,
    activeSection,
    discardOpen,
    setDiscardOpen,
    draftError,
    hasDraft,
    isDirty,
    tree,
    sidebarWidth,
    sidebarMode,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebarMode,
    handleEditorChange,
    handleRestoreDraft,
    handleDiscardDraft,
    handleDiscard,
    handleEditorMount,
    handleTreeClick,
    handleSplitterMouseDown,
    selectedText,
    handleSelectionChange,
    clearDraft,
  } = useMarkdownEntityEditor<MarkdownCategoryNode[], TSection>({
    storageKey,
    fetchMarkdown,
    buildTree,
    findSectionAtLine,
  });

  const { openChat } = useChatUI();
  const [historyOpen, setHistoryOpen] = useState(false);
  const toast = useToast();

  // Quota 溢れ時は握り潰さず toast で通知する（保存・Dirty 判定は不変）。
  useEffect(() => {
    if (draftError) {
      toast.error(draftError);
    }
  }, [draftError, toast]);

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

  const isBusy = savingMarkdown;

  useEditorSaveShortcut({
    canSave: isDirty,
    canFormat: true,
    isBusy,
    onSave: () => void handleSave(),
    onFormat: handleFormat,
  });

  const hover = useOverlapHover(() => setIsSidebarOpen(false));

  const showOverlapSidebar =
    sidebarMode === "overlap" && (isSidebarOpen || hover.isHovered);

  const renderTocContent = () => (
    <>
      <TocHeader
        title={`目次 (カテゴリ / ${entityTitle})`}
        mode={sidebarMode}
        onToggleMode={toggleSidebarMode}
      />
      <nav className="space-y-1">
        <MarkdownTocNav
          tree={tree}
          activeCategory={activeSection?.category}
          activeName={activeSection?.name}
          onJump={handleTreeClick}
        />
      </nav>
    </>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {hasDraft && (
        <MarkdownDraftBanner
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      <MarkdownToolbarRow
        left={
          <>
            <TocToggleButton
              active={isSidebarOpen || hover.isHovered}
              onToggle={() => setIsSidebarOpen((prev) => !prev)}
              onMouseEnter={hover.handleMouseEnter}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              disabled={!isDirty || isBusy}
              isLoading={isBusy}
            >
              保存
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFormat}
              disabled={isBusy}
              title="マークダウンのフォーマットを整形 (Shift+Alt+F)"
            >
              🧹 整形
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDiscardOpen(true)}
              disabled={!isDirty || isBusy}
            >
              変更を破棄
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setHistoryOpen(true)}
              title="マークダウンの編集履歴と差分を確認・復元"
            >
              🕒 履歴
            </Button>
            {isDirty && (
              <span className="text-muted-foreground text-xs">
                （未保存の変更があります）
              </span>
            )}
          </>
        }
        right={
          <>
            {extraToolbarActions}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpenChat}
              title="選択中のテキストまたは現在のセクションについてチャットでAIに相談"
            >
              💬 チャットで相談
            </Button>
          </>
        }
      />

      <div className="relative flex flex-1 overflow-hidden">
        <EditorSidebarShell
          mode={sidebarMode}
          sidebarWidth={sidebarWidth}
          onSplitterMouseDown={handleSplitterMouseDown}
          onToggleMode={toggleSidebarMode}
          onStripEnter={hover.handleMouseEnter}
          onStripLeave={hover.handleMouseLeave}
          onStripClick={() => setIsSidebarOpen((prev) => !prev)}
          onPanelEnter={hover.handleMouseEnter}
          onPanelLeave={hover.handleMouseLeave}
          showOverlap={showOverlapSidebar}
          renderToc={renderTocContent}
        />

        <main className="relative flex-1 overflow-hidden">
          <MonacoEditor
            value={markdown}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            onSelectionChange={handleSelectionChange}
          />
          <SelectionConsultBar
            selectedText={selectedText}
            label="選択範囲をチャットで相談"
            onConsult={handleOpenChat}
          />
        </main>
      </div>

      <ConfirmDialog
        isOpen={discardOpen}
        title="変更を破棄しますか？"
        message="保存していない変更はすべて失われます。よろしいですか？"
        confirmLabel="破棄する"
        cancelLabel="キャンセル"
        onConfirm={handleDiscard}
        onClose={() => setDiscardOpen(false)}
      />

      <HistoryDiffModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        novelId={novelId}
        entityType={entityType}
        entityId={novelId}
        currentContent={markdown}
        title={`${entityTitle}マークダウン全体`}
        onRestoreSuccess={(restored) => {
          setMarkdown(restored);
          setSavedMarkdown(restored);
        }}
      />
    </div>
  );
}
