import {
  formatCharactersMarkdown,
  formatForeshadowingsMarkdown,
  formatSettingsMarkdown,
  formatStoryOutlineMarkdown,
  type MarkdownCategoryNode,
} from "@novel-creator/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { HistoryDiffModal } from "@/components/HistoryDiffModal.js";
import { Loading } from "@/components/Loading.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useMarkdownEntityEditor } from "@/hooks/useMarkdownEntityEditor.js";
import { useToast } from "@/hooks/useToast.js";
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

  // チャット画面で提案が更新・反映された際のリアルタイム同期リスナー
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

  // チャット画面から「Markdownで確認・編集」をクリックした際のプレビュー読み込みリスナー
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

  // Ctrl+S / Cmd+S ショートカットで保存、Shift+Alt+F で整形
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !isBusy) {
          void handleSave();
        }
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (!isBusy) {
          handleFormat();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFormat, handleSave, isBusy, isDirty]);

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsSidebarOpen(false);
    }, 250);
  }, [setIsSidebarOpen]);

  const showOverlapSidebar =
    sidebarMode === "overlap" && (isSidebarOpen || isHovered);

  const renderTocContent = () => (
    <>
      <div className="mb-2 flex items-center justify-between border-border border-b px-1 pb-1.5 font-semibold text-muted-foreground text-xs">
        <span
          className="truncate font-bold text-foreground"
          title={`目次 (カテゴリ / ${entityTitle})`}
        >
          目次 (カテゴリ / {entityTitle})
        </span>
        <button
          type="button"
          onClick={toggleSidebarMode}
          title={
            sidebarMode === "pinned"
              ? "オーバーラップ表示に切替"
              : "ピン留め表示に切替"
          }
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {sidebarMode === "pinned" ? "📌" : "🔓"}
        </button>
      </div>
      <nav className="space-y-1">
        {tree.length === 0 ? (
          <div className="py-2 text-center text-muted-foreground text-xs">
            見出しがありません
          </div>
        ) : (
          tree.map((cat) => (
            <div key={cat.category} className="space-y-0.5">
              <div
                className="cursor-pointer truncate px-2 py-1 font-semibold text-muted-foreground text-xs hover:text-foreground"
                onClick={() => handleTreeClick(cat.headingLine)}
                title={`# ${cat.category}`}
              >
                # {cat.category}
              </div>
              <div className="ml-2 space-y-0.5 border-border border-l pl-2">
                {cat.children.map((item) => (
                  <div
                    key={`${cat.category}-${item.name}-${item.headingLine}`}
                    className={`cursor-pointer truncate rounded px-2 py-0.5 text-xs transition-colors ${
                      activeSection?.name === item.name &&
                      activeSection?.category === cat.category
                        ? "bg-primary/10 font-bold text-primary"
                        : "text-foreground hover:bg-surface-hover"
                    }`}
                    onClick={() => handleTreeClick(item.headingLine)}
                    title={`## ${item.name}`}
                  >
                    ## {item.name}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
    </>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {hasDraft && (
        <div
          role="region"
          aria-label="自動保存されたドラフト"
          className="flex items-center justify-between border-amber-500/30 border-b bg-amber-500/10 px-4 py-2 text-amber-900 text-sm dark:text-amber-200"
        >
          <span>未保存のドラフトがあります。復元しますか？</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleRestoreDraft}>
              復元する
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscardDraft}>
              破棄する
            </Button>
          </div>
        </div>
      )}

      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          {/* 目次トグルボタン */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            onMouseEnter={handleMouseEnter}
            title="目次サイドバーを開閉"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
              isSidebarOpen || isHovered
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <span className="font-medium">目次</span>
          </button>

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
        </div>
        <div className="flex items-center gap-2">
          {extraToolbarActions}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleOpenChat}
            title="選択中のテキストまたは現在のセクションについてチャットでAIに相談"
          >
            💬 チャットで相談
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* 固定（ピン留め）モード時のサイドバー */}
        {sidebarMode === "pinned" && (
          <>
            <aside
              style={{ width: `${sidebarWidth}px` }}
              className="shrink-0 overflow-y-auto border-border border-r bg-surface p-2 text-xs"
            >
              {renderTocContent()}
            </aside>

            {/* リサイザブルスプリッターバー */}
            <div
              onMouseDown={handleSplitterMouseDown}
              className="z-10 -ml-0.5 w-1.5 shrink-0 cursor-col-resize select-none bg-border transition-colors hover:w-2 hover:bg-primary/50"
              title="ドラッグして幅を調整"
            />
          </>
        )}

        {/* オーバーラップ（フロート）モード時の縮小ストリップ */}
        {sidebarMode === "overlap" && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
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

        {/* オーバーラップ（フロート）モード時の展開サイドバー */}
        {showOverlapSidebar && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="absolute top-0 bottom-0 left-7 z-30 flex shadow-2xl"
          >
            <aside
              style={{ width: `${sidebarWidth}px` }}
              className="slide-in-from-left flex animate-in flex-col overflow-y-auto border-border border-r bg-surface/98 p-2 text-xs backdrop-blur-md duration-150"
            >
              {renderTocContent()}
            </aside>
          </div>
        )}

        <main className="relative flex-1 overflow-hidden">
          <MonacoEditor
            value={markdown}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            onSelectionChange={handleSelectionChange}
          />

          {/* 選択テキストがある場合のチャット相談トリガーバー */}
          {selectedText && (
            <div className="fade-in slide-in-from-top-1 absolute top-4 right-8 z-30 animate-in duration-150">
              <button
                type="button"
                onClick={handleOpenChat}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/20 bg-primary px-3.5 py-1.5 font-bold text-primary-foreground text-xs shadow-lg transition hover:brightness-110"
              >
                <span>
                  💬 選択範囲をチャットで相談 ({selectedText.length}文字)
                </span>
              </button>
            </div>
          )}
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
