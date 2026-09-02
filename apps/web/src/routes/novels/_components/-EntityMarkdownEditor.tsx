import type { MarkdownCategoryNode } from "@novel-creator/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { AIProgressIndicator } from "@/components/AIProgressIndicator.js";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { HistoryDiffModal } from "@/components/HistoryDiffModal.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useMarkdownEntityEditor } from "@/hooks/useMarkdownEntityEditor.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { MonacoEditor } from "./-MonacoEditor.js";

export interface EntityMarkdownEditorProps<
  TSection extends { category: string; name: string },
> {
  buildTree: (markdown: string) => MarkdownCategoryNode[];
  documentPlaceholder?: string;
  editingDocument: boolean;
  editingSection: boolean;
  entityTitle: string;
  entityType:
    | "characters_markdown"
    | "settings_markdown"
    | "foreshadowings_document"
    | "foreshadowings_markdown"
    | "story_outline_markdown";
  extraToolbarActions?: React.ReactNode;
  fetchMarkdown: () => Promise<string>;
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
  novelId: string;
  onEditDocument: (params: {
    instruction: string;
    markdown: string;
  }) => Promise<string>;
  onEditSection: (params: {
    activeSection: TSection;
    instruction: string;
    markdown: string;
  }) => Promise<string>;
  saveMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  savingMarkdown: boolean;
  sectionPlaceholder?: (activeSection: TSection | null) => string;
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
  onEditSection,
  onEditDocument,
  savingMarkdown,
  editingSection,
  editingDocument,
  sectionPlaceholder,
  documentPlaceholder,
  extraToolbarActions,
}: EntityMarkdownEditorProps<TSection>) {
  const {
    markdown,
    setMarkdown,
    setSavedMarkdown,
    loading,
    instruction,
    setInstruction,
    editScope,
    setEditScope,
    activeSection,
    discardOpen,
    setDiscardOpen,
    hasDraft,
    isDirty,
    tree,
    sidebarWidth,
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
  const [aiError, setAiError] = useState<string | null>(null);
  const toast = useToast();
  const runStartedAtRef = useRef<number>(Date.now());

  // チャット画面でストーリー構想が更新された際のリアルタイム同期リスナー
  useEffect(() => {
    if (entityType !== "story_outline_markdown") {
      return;
    }

    const handleExternalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        novelId: string;
        markdown: string;
        appliedSection?: string;
      }>;
      if (!customEvent.detail || customEvent.detail.novelId !== novelId) {
        return;
      }

      const { markdown: newMarkdown, appliedSection } = customEvent.detail;
      setMarkdown(newMarkdown);
      setSavedMarkdown(newMarkdown);
      clearDraft();
      toast.success(
        `チャットからの提案（${appliedSection || "ストーリー構想"}）をエディタに同期しました`
      );
    };

    window.addEventListener(
      "novel-creator:story-outline-updated",
      handleExternalUpdate
    );
    return () => {
      window.removeEventListener(
        "novel-creator:story-outline-updated",
        handleExternalUpdate
      );
    };
  }, [clearDraft, entityType, novelId, setMarkdown, setSavedMarkdown, toast]);

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

  const handleRun = useCallback(async () => {
    if (!instruction.trim()) {
      toast.error("指示を入力してください");
      return;
    }

    setAiError(null);
    runStartedAtRef.current = Date.now();
    try {
      if (editScope === "document") {
        const next = await onEditDocument({ markdown, instruction });
        setMarkdown(next);
        toast.success("全体のAI編集が完了しました");
        return;
      }

      if (!activeSection) {
        toast.error(
          `カーソルを編集対象の${entityTitle}セクション（## 見出し配下）に移動してください`
        );
        return;
      }

      const nextSummary = await onEditSection({
        activeSection,
        instruction,
        markdown,
      });

      setMarkdown(nextSummary);
      toast.success(`「${activeSection.name}」のAI編集が完了しました`);
    } catch (e) {
      const errMsg = toErrorMessage(e);
      setAiError(errMsg);
      toast.error(errMsg);
    }
  }, [
    activeSection,
    entityTitle,
    editScope,
    instruction,
    markdown,
    onEditDocument,
    onEditSection,
    setMarkdown,
    toast,
  ]);

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

  const isBusy = savingMarkdown || editingSection || editingDocument;

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !isBusy) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, isBusy, isDirty]);

  if (loading) {
    return <Loading message={`${entityTitle}マークダウンを読み込み中...`} />;
  }

  return (
    <div className="flex h-full flex-col">
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

      <div className="flex items-center justify-between border-border border-b bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || isBusy}
            isLoading={savingMarkdown}
            title="保存 (Ctrl+S)"
          >
            保存
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

      <div className="border-border border-b bg-surface p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">
              編集対象:
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-foreground">
              <input
                type="radio"
                name={`${entityType}-edit-scope`}
                value="section"
                checked={editScope === "section"}
                onChange={() => setEditScope("section")}
                disabled={isBusy}
              />
              選択セクション
              {activeSection && (
                <span className="ml-1 font-mono text-primary">
                  [{activeSection.category}] {activeSection.name}
                </span>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-foreground">
              <input
                type="radio"
                name={`${entityType}-edit-scope`}
                value="document"
                checked={editScope === "document"}
                onChange={() => setEditScope("document")}
                disabled={isBusy}
              />
              ドキュメント全体
            </label>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={
                  editScope === "section"
                    ? sectionPlaceholder
                      ? sectionPlaceholder(activeSection)
                      : activeSection
                        ? `「${activeSection.name}」への指示`
                        : `カーソルを${entityTitle}セクション内に置いてください`
                    : (documentPlaceholder ?? "全体への指示")
                }
                value={instruction}
                onChange={(e) => {
                  setInstruction(e.target.value);
                  if (aiError) {
                    setAiError(null);
                  }
                }}
                disabled={isBusy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    void handleRun();
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={handleRun}
              disabled={isBusy || !instruction.trim()}
              isLoading={editingSection || editingDocument}
            >
              LLMで編集
            </Button>
          </div>

          {aiError && (
            <div className="fade-in flex animate-in items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs duration-200">
              <div className="flex min-w-0 items-start gap-2">
                <span className="shrink-0 text-base leading-none">⚠️</span>
                <div className="min-w-0 space-y-1">
                  <div className="font-bold">AI編集エラーが発生しました</div>
                  <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed opacity-95">
                    {aiError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="shrink-0 cursor-pointer rounded p-1 text-destructive/70 transition hover:bg-destructive/10 hover:text-destructive"
                title="エラー表示を閉じる"
              >
                ✕
              </button>
            </div>
          )}

          {isBusy && (
            <AIProgressIndicator
              variant="inline"
              stage={
                editingDocument || editScope === "document"
                  ? `AIが${entityTitle}マークダウン全体を再編成・推敲中...`
                  : `AIが「${activeSection?.name ?? entityTitle}」を推敲・編集案を生成中...`
              }
              description="指示内容に基づいてマークダウンを生成しています。完了までしばらくお待ちください。"
              startedAt={runStartedAtRef.current}
            />
          )}
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 overflow-y-auto border-border border-r bg-surface p-2 text-xs"
        >
          <div className="mb-1 px-2 py-1 font-semibold text-muted-foreground">
            目次 (カテゴリ / {entityTitle})
          </div>
          {tree.length === 0 ? (
            <div className="p-2 text-muted-foreground italic">
              {entityTitle}が見つかりません
            </div>
          ) : (
            tree.map((cat) => (
              <div key={cat.category} className="mb-2">
                <div className="rounded bg-surface-raised px-2 py-1 font-bold text-foreground">
                  {cat.category}
                </div>
                <div className="mt-1 ml-2 space-y-0.5">
                  {cat.children.map((item) => {
                    const isActive =
                      activeSection?.category === cat.category &&
                      activeSection?.name === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleTreeClick(item.headingLine)}
                        className={`block w-full truncate rounded px-2 py-1 text-left transition-colors ${
                          isActive
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-foreground hover:bg-surface-raised"
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </aside>

        {/* リサイザブルスプリッターバー */}
        <div
          onMouseDown={handleSplitterMouseDown}
          className="z-10 -ml-0.5 w-1.5 shrink-0 cursor-col-resize select-none bg-border transition-colors hover:w-2 hover:bg-primary/50"
          title="ドラッグして幅を調整"
        />

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
