import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import {
  buildCharacterTree,
  findCharacterAtLine,
  getCharacterSections,
} from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { useMarkdownDraft } from '@/hooks/useMarkdownDraft.js';
import type { SaveCharactersMarkdownResult } from '@/lib/types.js';
import { MonacoEditor } from './-MonacoEditor.js';

type MonacoEditorInstance = Parameters<OnMount>[0];

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
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [editScope, setEditScope] = useState<'section' | 'document'>('section');
  const [activeSection, setActiveSection] = useState<{
    category: string;
    name: string;
  } | null>(null);
  const [savedMarkdown, setSavedMarkdown] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);

  const editorRef = useRef<MonacoEditorInstance | null>(null);

  const { hasDraft, draftContent, saveDraft, clearDraft, dismissDraft, checkDraft } =
    useMarkdownDraft({
      storageKey: `novel-creator:draft:characters:${novelId}`,
    });

  const tree = useMemo(() => buildCharacterTree(markdown), [markdown]);

  const isDirty = markdown !== savedMarkdown;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchCharactersMarkdown()
      .then((md) => {
        if (!active) return;
        setMarkdown(md);
        setSavedMarkdown(md);
        checkDraft();
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchCharactersMarkdown, checkDraft]);

  const handleEditorChange = useCallback(
    (value: string) => {
      setMarkdown(value);
      saveDraft(value);
    },
    [saveDraft],
  );

  const handleRestoreDraft = useCallback(() => {
    if (draftContent === null) return;
    setMarkdown(draftContent);
    saveDraft(draftContent);
    dismissDraft();
  }, [draftContent, saveDraft, dismissDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const handleDiscard = useCallback(async () => {
    setDiscardOpen(false);
    setError(null);
    setMessage(null);
    clearDraft();
    try {
      const md = await fetchCharactersMarkdown();
      setMarkdown(md);
      setSavedMarkdown(md);
    } catch (e) {
      setError(e instanceof Error ? e.message : '破棄に失敗しました');
    }
  }, [clearDraft, fetchCharactersMarkdown]);

  const handleEditorMount = useCallback(
    (editorInstance: MonacoEditorInstance) => {
      editorRef.current = editorInstance;
      editorInstance.onDidChangeCursorPosition((e) => {
        const section = findCharacterAtLine(markdown, e.position.lineNumber);
        setActiveSection(section ? { category: section.category, name: section.name } : null);
      });
    },
    [markdown],
  );

  const handleTreeClick = useCallback((headingLine: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    const lineNumber = headingLine + 1;
    ed.revealLineInCenter(lineNumber);
    ed.setPosition({ lineNumber, column: 1 });
    ed.focus();
  }, []);

  const handleRun = useCallback(async () => {
    setError(null);
    setMessage(null);
    if (!instruction.trim()) {
      setMessage('指示を入力してください');
      return;
    }
    if (editScope === 'section') {
      if (!activeSection) {
        setMessage('セクションを選択してください');
        return;
      }
      const sections = getCharacterSections(markdown);
      const target = sections.find(
        (s) => s.category === activeSection.category && s.name === activeSection.name,
      );
      if (!target) {
        setMessage('対象のセクションが見つかりません');
        return;
      }
      try {
        const result = await editCharacterSection({
          category: target.category,
          name: target.name,
          description: target.description,
          traits: target.traits,
          relationships: target.relationships,
          instruction: instruction.trim(),
        });
        const lines = markdown.split('\n');
        const newLines = [
          ...lines.slice(0, target.startLine),
          ...result.split('\n'),
          ...lines.slice(target.endLine + 1),
        ];
        const updated = newLines.join('\n');
        setMarkdown(updated);
        saveDraft(updated);
        setInstruction('');
      } catch (e) {
        setError(e instanceof Error ? e.message : '編集に失敗しました');
      }
      return;
    }
    try {
      const result = await editCharacterDocument({
        markdown,
        instruction: instruction.trim(),
      });
      setMarkdown(result);
      saveDraft(result);
      setInstruction('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '編集に失敗しました');
    }
  }, [
    activeSection,
    instruction,
    markdown,
    editScope,
    editCharacterSection,
    editCharacterDocument,
    saveDraft,
  ]);

  const handleSave = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const result = await saveCharactersMarkdown(markdown);
      clearDraft();
      setSavedMarkdown(markdown);
      setMessage(
        `保存しました（作成: ${result.created} / 更新: ${result.updated} / 削除: ${result.deleted} / 重複: ${result.duplicateCount}）`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [markdown, saveCharactersMarkdown, clearDraft]);

  if (loading) return <Loading message="人物マークダウンを読み込み中..." />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {hasDraft && draftContent !== null && draftContent !== savedMarkdown && (
        <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900/30 dark:bg-amber-900/20">
          <span className="text-amber-700 dark:text-amber-300">未保存の編集があります</span>
          <div className="flex gap-2">
            <button
              onClick={handleRestoreDraft}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              復元
            </button>
            <button
              onClick={handleDiscardDraft}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              破棄
            </button>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {/* ツリー */}
        <div className="h-full w-60 shrink-0 overflow-auto border-r border-slate-200 p-3 dark:border-slate-700">
          <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            カテゴリ / 人物
          </h3>
          {tree.length === 0 && (
            <p className="px-2 text-sm text-slate-400 dark:text-slate-500">人物がありません。</p>
          )}
          {tree.map((category) => (
            <div key={category.category} className="mb-2">
              <div className="px-2 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {category.category}
              </div>
              {category.children.map((child) => {
                const isActive =
                  activeSection?.category === category.category &&
                  activeSection.name === child.name;
                return (
                  <button
                    key={child.name}
                    onClick={() => handleTreeClick(child.headingLine)}
                    className={`block w-full rounded px-2 py-1 text-left text-sm transition ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {child.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* エディタ */}
        <div className="h-full min-w-0 flex-1 overflow-hidden">
          <MonacoEditor
            value={markdown}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
          />
        </div>
      </div>

      {/* LLM指示バー */}
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
          <button
            onClick={() => setEditScope('section')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              editScope === 'section'
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            セクション
          </button>
          <button
            onClick={() => setEditScope('document')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              editScope === 'document'
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            全体
          </button>
        </div>
        <div className="flex-1">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="LLMへの指示を入力（例: もっと詳細に書いて）"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRun();
            }}
          />
        </div>
        <Button
          variant="secondary"
          onClick={handleRun}
          isLoading={editingSection || editingDocument}
          disabled={!instruction.trim()}
        >
          実行
        </Button>
        {isDirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            未保存
          </span>
        )}
        <Button onClick={handleSave} isLoading={savingMarkdown}>
          保存
        </Button>
        <Button variant="secondary" onClick={() => setDiscardOpen(true)} disabled={!isDirty}>
          破棄
        </Button>
      </div>

      {message && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          {message}
        </div>
      )}
      {error && (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}
      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleDiscard}
        title="編集内容を破棄しますか？"
        message="サーバーに保存済みの内容に戻します。この操作は元に戻せません。"
        confirmLabel="破棄"
        isLoading={false}
      />
    </div>
  );
}
