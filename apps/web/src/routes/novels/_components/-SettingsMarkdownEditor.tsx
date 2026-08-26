import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { buildSettingTree, findSectionAtLine, getMarkdownSections } from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { useSettings } from '@/hooks/useSettings.js';
import { MonacoEditor } from './-MonacoEditor.js';

type MonacoEditorInstance = Parameters<OnMount>[0];

interface SettingsMarkdownEditorProps {
  novelId: string;
}

export function SettingsMarkdownEditor({ novelId }: SettingsMarkdownEditorProps) {
  const {
    fetchSettingsMarkdown,
    saveSettingsMarkdown,
    editSettingSection,
    savingMarkdown,
    editingSection,
  } = useSettings(novelId);

  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [activeSection, setActiveSection] = useState<{
    category: string;
    name: string;
  } | null>(null);

  const editorRef = useRef<MonacoEditorInstance | null>(null);

  const tree = useMemo(() => buildSettingTree(markdown), [markdown]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchSettingsMarkdown()
      .then((md) => {
        if (!active) return;
        setMarkdown(md);
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
  }, [fetchSettingsMarkdown]);

  const handleEditorMount = useCallback(
    (editorInstance: MonacoEditorInstance) => {
      editorRef.current = editorInstance;
      editorInstance.onDidChangeCursorPosition((e) => {
        const section = findSectionAtLine(markdown, e.position.lineNumber);
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
    if (!activeSection) {
      setMessage('セクションを選択してください');
      return;
    }
    if (!instruction.trim()) {
      setMessage('指示を入力してください');
      return;
    }
    const sections = getMarkdownSections(markdown);
    const target = sections.find(
      (s) => s.category === activeSection.category && s.name === activeSection.name,
    );
    if (!target) {
      setMessage('対象のセクションが見つかりません');
      return;
    }
    try {
      const result = await editSettingSection({
        category: target.category,
        name: target.name,
        description: target.description,
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
      setInstruction('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '編集に失敗しました');
    }
  }, [activeSection, instruction, markdown, editSettingSection]);

  const handleSave = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const result = await saveSettingsMarkdown(markdown);
      setMessage(
        `保存しました（作成: ${result.created} / 更新: ${result.updated} / 削除: ${result.deleted} / 重複: ${result.duplicateCount}）`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [markdown, saveSettingsMarkdown]);

  if (loading) return <Loading message="設定マークダウンを読み込み中..." />;

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex min-h-0 flex-1">
        {/* ツリー */}
        <div className="w-60 shrink-0 overflow-auto border-r border-slate-200 p-3 dark:border-slate-700">
          <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            カテゴリ / 設定
          </h3>
          {tree.length === 0 && (
            <p className="px-2 text-sm text-slate-400 dark:text-slate-500">設定がありません。</p>
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
        <div className="min-w-0 flex-1 overflow-hidden">
          <MonacoEditor value={markdown} onChange={setMarkdown} onMount={handleEditorMount} />
        </div>
      </div>

      {/* LLM指示バー */}
      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
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
          isLoading={editingSection}
          disabled={!instruction.trim()}
        >
          実行
        </Button>
        <Button onClick={handleSave} isLoading={savingMarkdown}>
          保存
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
    </div>
  );
}
