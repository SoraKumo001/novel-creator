import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownCategoryNode } from '@novel-creator/shared';
import { AIProgressIndicator } from '@/components/AIProgressIndicator.js';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { useMarkdownEntityEditor } from '@/hooks/useMarkdownEntityEditor.js';
import { useChat } from '@/hooks/useChat.js';
import { useToast } from '@/hooks/useToast.js';
import { MonacoEditor } from './-MonacoEditor.js';

export interface EntityMarkdownEditorProps<TSection extends { category: string; name: string }> {
  novelId: string;
  entityTitle: string;
  entityType:
    | 'characters_markdown'
    | 'settings_markdown'
    | 'foreshadowings_document'
    | 'foreshadowings_markdown';
  storageKey: string;
  fetchMarkdown: () => Promise<string>;
  saveMarkdown: (
    markdown: string,
  ) => Promise<{ created: number; updated: number; deleted: number }>;
  buildTree: (markdown: string) => MarkdownCategoryNode[];
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
  onEditSection: (params: {
    activeSection: TSection;
    instruction: string;
    markdown: string;
  }) => Promise<string>;
  onEditDocument: (params: { instruction: string; markdown: string }) => Promise<string>;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
  sectionPlaceholder?: (activeSection: TSection | null) => string;
  documentPlaceholder?: string;
}

export function EntityMarkdownEditor<TSection extends { category: string; name: string }>({
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

  const { openChat } = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const toast = useToast();
  const runStartedAtRef = useRef<number>(Date.now());

  const handleOpenChat = useCallback(() => {
    if (selectedText.trim()) {
      openChat(novelId, {
        entityType: 'selection',
        title: `${entityTitle}（選択範囲）`,
        selectedText: selectedText.trim(),
      });
      return;
    }

    if (activeSection) {
      openChat(novelId, {
        entityType: 'markdown_section',
        title: `${entityTitle}「${activeSection.name}」`,
        summary: `カテゴリー: ${activeSection.category}\n名前: ${activeSection.name}`,
      });
      return;
    }

    openChat(novelId, {
      entityType: 'markdown_section',
      title: `${entityTitle}全体`,
      summary: markdown.slice(0, 500) + (markdown.length > 500 ? '…' : ''),
    });
  }, [activeSection, entityTitle, markdown, novelId, openChat, selectedText]);

  const handleRun = useCallback(async () => {
    if (!instruction.trim()) {
      toast.error('指示を入力してください');
      return;
    }

    runStartedAtRef.current = Date.now();
    try {
      if (editScope === 'document') {
        const next = await onEditDocument({ markdown, instruction });
        setMarkdown(next);
        toast.success('全体のAI編集が完了しました');
        return;
      }

      if (!activeSection) {
        toast.error(
          `カーソルを編集対象の${entityTitle}セクション（## 見出し配下）に移動してください`,
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
      toast.error(e instanceof Error ? e.message : '編集に失敗しました');
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
      toast.success(
        `保存しました (作成: ${res.created}件, 更新: ${res.updated}件, 削除: ${res.deleted}件)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [clearDraft, markdown, saveMarkdown, setSavedMarkdown, toast]);

  const isBusy = savingMarkdown || editingSection || editingDocument;

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty && !isBusy) {
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
          className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between"
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

      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface">
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
            <span className="text-xs text-muted-foreground">（未保存の変更があります）</span>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      <div className="border-b border-border p-4 bg-surface">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">編集対象:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
              <input
                type="radio"
                name={`${entityType}-edit-scope`}
                value="section"
                checked={editScope === 'section'}
                onChange={() => setEditScope('section')}
                disabled={isBusy}
              />
              選択セクション
              {activeSection && (
                <span className="text-primary font-mono ml-1">
                  [{activeSection.category}] {activeSection.name}
                </span>
              )}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
              <input
                type="radio"
                name={`${entityType}-edit-scope`}
                value="document"
                checked={editScope === 'document'}
                onChange={() => setEditScope('document')}
                disabled={isBusy}
              />
              ドキュメント全体
            </label>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={
                  editScope === 'section'
                    ? sectionPlaceholder
                      ? sectionPlaceholder(activeSection)
                      : activeSection
                        ? `「${activeSection.name}」への指示`
                        : `カーソルを${entityTitle}セクション内に置いてください`
                    : (documentPlaceholder ?? '全体への指示')
                }
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={isBusy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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

          {isBusy && (
            <AIProgressIndicator
              variant="inline"
              stage={
                editingDocument || editScope === 'document'
                  ? `AIが${entityTitle}マークダウン全体を再編成・推敲中...`
                  : `AIが「${activeSection?.name ?? entityTitle}」を推敲・編集案を生成中...`
              }
              description="指示内容に基づいてマークダウンを生成しています。完了までしばらくお待ちください。"
              startedAt={runStartedAtRef.current}
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 border-r border-border bg-surface overflow-y-auto p-2 text-xs"
        >
          <div className="font-semibold text-muted-foreground px-2 py-1 mb-1">
            目次 (カテゴリ / {entityTitle})
          </div>
          {tree.length === 0 ? (
            <div className="text-muted-foreground p-2 italic">{entityTitle}が見つかりません</div>
          ) : (
            tree.map((cat) => (
              <div key={cat.category} className="mb-2">
                <div className="font-bold text-foreground px-2 py-1 bg-surface-raised rounded">
                  {cat.category}
                </div>
                <div className="ml-2 mt-1 space-y-0.5">
                  {cat.children.map((item) => {
                    const isActive =
                      activeSection?.category === cat.category && activeSection?.name === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleTreeClick(item.headingLine)}
                        className={`w-full text-left px-2 py-1 rounded truncate block transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'hover:bg-surface-raised text-foreground'
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
          className="w-1.5 hover:w-2 -ml-0.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors shrink-0 select-none z-10"
          title="ドラッグして幅を調整"
        />

        <main className="flex-1 overflow-hidden relative">
          <MonacoEditor
            value={markdown}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            onSelectionChange={handleSelectionChange}
          />

          {/* 選択テキストがある場合のチャット相談トリガーバー */}
          {selectedText && (
            <div className="absolute top-4 right-8 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={handleOpenChat}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-lg hover:brightness-110 transition cursor-pointer border border-primary/20"
              >
                <span>💬 選択範囲をチャットで相談 ({selectedText.length}文字)</span>
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
