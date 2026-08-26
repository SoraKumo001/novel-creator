import { useCallback } from 'react';
import {
  buildCharacterTree,
  findCharacterAtLine,
  getCharacterSections,
  type CharacterCategoryNode,
} from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { useMarkdownEntityEditor } from '@/hooks/useMarkdownEntityEditor.js';
import type { SaveCharactersMarkdownResult } from '@/lib/types.js';
import { MonacoEditor } from './-MonacoEditor.js';

interface CharactersMarkdownEditorProps {
  novelId: string;
  fetchCharactersMarkdown: () => Promise<string>;
  saveCharactersMarkdown: (markdown: string) => Promise<SaveCharactersMarkdownResult>;
  editCharacterSection: (input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }) => Promise<string>;
  editCharacterDocument: (input: { markdown: string; instruction: string }) => Promise<string>;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
}

export function CharactersMarkdownEditor({
  novelId,
  fetchCharactersMarkdown,
  saveCharactersMarkdown,
  editCharacterSection,
  editCharacterDocument,
  savingMarkdown,
  editingSection,
  editingDocument,
}: CharactersMarkdownEditorProps) {
  const {
    markdown,
    setMarkdown,
    setSavedMarkdown,
    loading,
    error,
    setError,
    message,
    setMessage,
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
    handleEditorChange,
    handleRestoreDraft,
    handleDiscardDraft,
    handleDiscard,
    handleEditorMount,
    handleTreeClick,
    clearDraft,
  } = useMarkdownEntityEditor<CharacterCategoryNode[]>({
    storageKey: `novel-creator:draft:characters:${novelId}`,
    fetchMarkdown: fetchCharactersMarkdown,
    buildTree: buildCharacterTree,
    findSectionAtLine: findCharacterAtLine,
  });

  const handleRun = useCallback(async () => {
    setError(null);
    setMessage(null);
    if (!instruction.trim()) {
      setMessage('指示を入力してください');
      return;
    }

    try {
      if (editScope === 'document') {
        const next = await editCharacterDocument({ markdown, instruction });
        setMarkdown(next);
        setMessage('全体の編集が完了しました');
        return;
      }

      if (!activeSection) {
        setMessage('カーソルを編集対象の人物セクション（## 見出し配下）に移動してください');
        return;
      }

      const sections = getCharacterSections(markdown);
      const target = sections.find(
        (s) => s.category === activeSection.category && s.name === activeSection.name,
      );

      if (!target) {
        setMessage(`人物「${activeSection.name}」のセクションが見つかりません`);
        return;
      }

      const nextSummary = await editCharacterSection({
        category: target.category,
        name: target.name,
        description: target.description,
        traits: target.traits,
        relationships: target.relationships,
        instruction,
      });

      const lines = markdown.split('\n');
      const before = lines.slice(0, target.startLine);
      const after = lines.slice(target.endLine);
      const replaced = [...before, nextSummary.trim(), ...after].join('\n');
      setMarkdown(replaced);
      setMessage(`「${activeSection.name}」の編集が完了しました`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '編集に失敗しました');
    }
  }, [
    activeSection,
    editCharacterDocument,
    editCharacterSection,
    editScope,
    instruction,
    markdown,
    setError,
    setMessage,
    setMarkdown,
  ]);

  const handleSave = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await saveCharactersMarkdown(markdown);
      setSavedMarkdown(markdown);
      clearDraft();
      setMessage(
        `保存しました (作成: ${res.created}件, 更新: ${res.updated}件, 削除: ${res.deleted}件)`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [clearDraft, markdown, saveCharactersMarkdown, setError, setMessage, setSavedMarkdown]);

  if (loading) {
    return <Loading message="人物マークダウンを読み込み中..." />;
  }

  const isBusy = savingMarkdown || editingSection || editingDocument;

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

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-sm text-red-900 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2 text-sm text-emerald-900 dark:text-emerald-300">
          {message}
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
          {isDirty && (
            <span className="text-xs text-muted-foreground">（未保存の変更があります）</span>
          )}
        </div>
      </div>

      <div className="border-b border-border p-4 bg-surface">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">編集対象:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
              <input
                type="radio"
                name="char-edit-scope"
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
                name="char-edit-scope"
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
                    ? activeSection
                      ? `「${activeSection.name}」への指示（例: 目的を復讐に変更して）`
                      : 'カーソルを人物セクション内に置いてください'
                    : '全体への指示（例: 敵対組織の幹部を2名追加して）'
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
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-border bg-surface overflow-y-auto p-2 text-xs">
          <div className="font-semibold text-muted-foreground px-2 py-1 mb-1">
            目次 (カテゴリ / 人物)
          </div>
          {tree.length === 0 ? (
            <div className="text-muted-foreground p-2 italic">人物が見つかりません</div>
          ) : (
            tree.map((cat) => (
              <div key={cat.category} className="mb-2">
                <div className="font-bold text-foreground px-2 py-1 bg-surface-raised rounded">
                  # {cat.category}
                </div>
                <div className="ml-2 mt-1 space-y-0.5">
                  {cat.children.map((ch) => {
                    const isActive =
                      activeSection?.category === cat.category && activeSection?.name === ch.name;
                    return (
                      <button
                        key={ch.name}
                        type="button"
                        onClick={() => handleTreeClick(ch.headingLine)}
                        className={`w-full text-left px-2 py-1 rounded truncate block transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'hover:bg-surface-raised text-foreground'
                        }`}
                        title={ch.name}
                      >
                        ## {ch.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </aside>

        <main className="flex-1 overflow-hidden relative">
          <MonacoEditor
            value={markdown}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
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
    </div>
  );
}
