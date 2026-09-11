import type { MarkdownCategoryNode } from "@novel-creator/shared";
import { useCallback, useState } from "react";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { HistoryDiffModal } from "@/components/HistoryDiffModal.js";
import { Loading } from "@/components/Loading.js";
import { ReadingTime } from "@/components/ReadingTime.js";
import {
  EditorSidebarShell,
  MarkdownDraftBanner,
  MarkdownFormatBar,
  MarkdownPreviewDock,
  MarkdownTocNav,
  MarkdownToolbarRow,
  MarkdownViewDropdown,
  SelectionConsultBar,
  TocHeader,
  TocToggleButton,
  useEditorSaveShortcut,
  useMarkdownInsertShortcut,
  useOverlapHover,
} from "@/features/editor/components/MarkdownEditorCore.js";
import { MonacoEditor } from "@/features/editor/components/MonacoEditor.js";
import { SaveStatusBadge } from "@/features/editor/components/SaveStatusBadge.js";
import { useEntityMarkdownActions } from "@/hooks/useEntityMarkdownActions.js";
import { useMarkdownEntityEditor } from "@/hooks/useMarkdownEntityEditor.js";
import { useMonacoPrefs } from "@/hooks/useMonacoPrefs.js";
import {
  loadPreviewMode,
  type MarkdownPreviewMode,
  savePreviewMode,
} from "@/lib/editor-storage.js";

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
    editorRef,
    hasDraft,
    insertMarkdown,
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

  const [historyOpen, setHistoryOpen] = useState(false);

  // 最小プレビュードック（開閉式、既定は閉）。表示モードのみ永続化する。
  // 実体は `@/lib/editor-storage`。
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewModeState] = useState<MarkdownPreviewMode>(() =>
    loadPreviewMode(storageKey)
  );
  const setPreviewMode = useCallback(
    (mode: MarkdownPreviewMode) => {
      setPreviewModeState(mode);
      savePreviewMode(storageKey, mode);
    },
    [storageKey]
  );

  // Monaco 最小設定（文字サイズ・折返し）は useMonacoPrefs に統一する。
  // 既定は従来表示（15 / on）のまま。
  const {
    editorFontSize,
    editorWordWrap,
    handleEditorFontSize,
    handleToggleWordWrap,
  } = useMonacoPrefs(storageKey);

  // 操作系（整形・保存・チャット相談・検索・差分適用）はカスタムフックへ切り出す。
  // チャット提案の外部同期購読とドラフトエラーの toast 通知も含む。
  const {
    handleFormat,
    handleOpenChat,
    handleOpenFind,
    handleRestoreSuccess,
    handleSave,
  } = useEntityMarkdownActions({
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
  });

  const isBusy = savingMarkdown;

  useEditorSaveShortcut({
    canSave: isDirty,
    canFormat: true,
    isBusy,
    onSave: () => void handleSave(),
    onFormat: handleFormat,
  });

  // 挿入ショートカット最小セット（エディタフォーカス時のみ、IME変換中は無効）。
  useMarkdownInsertShortcut({
    enabled: !loading && !isBusy,
    isEditorFocused: () => editorRef.current?.hasTextFocus() === true,
    onInsert: insertMarkdown,
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
          <div className="flex items-center gap-3">
            <TocToggleButton
              active={isSidebarOpen || hover.isHovered}
              onToggle={() => setIsSidebarOpen((prev) => !prev)}
              onMouseEnter={hover.handleMouseEnter}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  {entityTitle}
                </h3>
                <SaveStatusBadge isDirty={isDirty} saving={isBusy} />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs sm:gap-3">
                <span>
                  文字数:{" "}
                  <strong className="text-foreground">
                    {markdown.length.toLocaleString()}
                  </strong>
                </span>
                <span>•</span>
                <ReadingTime chars={markdown.length} />
              </div>
            </div>
          </div>
        }
        right={
          <>
            <MarkdownViewDropdown
              previewOpen={previewOpen}
              onTogglePreview={() => setPreviewOpen((prev) => !prev)}
              editorFontSize={editorFontSize}
              onEditorFontSize={handleEditorFontSize}
              editorWordWrap={editorWordWrap}
              onToggleWordWrap={handleToggleWordWrap}
              onOpenHistory={() => setHistoryOpen(true)}
              disabled={isBusy}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpenChat}
              disabled={isBusy}
              title="選択中のテキストまたは現在のセクションについてチャットでAIに相談"
            >
              💬 チャットで相談
            </Button>
            {extraToolbarActions}
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
              variant="primary"
              onClick={handleSave}
              disabled={!isDirty || isBusy}
              isLoading={isBusy}
              title="変更を保存 (Ctrl+S)"
            >
              保存
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

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <MarkdownFormatBar
            onInsert={insertMarkdown}
            onOpenFind={handleOpenFind}
            disabled={isBusy}
          />
          <div className="relative flex-1 overflow-hidden">
            <MonacoEditor
              value={markdown}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              onSelectionChange={handleSelectionChange}
              fontSize={editorFontSize}
              wordWrap={editorWordWrap}
            />
            <SelectionConsultBar
              selectedText={selectedText}
              label="選択範囲をチャットで相談"
              onConsult={handleOpenChat}
            />
          </div>
        </main>

        {previewOpen && (
          <MarkdownPreviewDock
            mode={previewMode}
            onModeChange={setPreviewMode}
            onClose={() => setPreviewOpen(false)}
            markdown={markdown}
            title={entityTitle}
          />
        )}
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
        onRestoreSuccess={handleRestoreSuccess}
      />
    </div>
  );
}
