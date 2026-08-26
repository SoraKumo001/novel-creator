import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { editor } from 'monaco-editor';
import { useMarkdownDraft } from '@/hooks/useMarkdownDraft.js';

export type MonacoEditorInstance = editor.IStandaloneCodeEditor;

export interface UseMarkdownEntityEditorOptions<TTree, TSection> {
  storageKey: string;
  fetchMarkdown: () => Promise<string>;
  buildTree: (markdown: string) => TTree;
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
}

export interface UseMarkdownEntityEditorReturn<TTree> {
  markdown: string;
  setMarkdown: (value: string) => void;
  savedMarkdown: string;
  setSavedMarkdown: (value: string) => void;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  message: string | null;
  setMessage: (msg: string | null) => void;
  instruction: string;
  setInstruction: (ins: string) => void;
  editScope: 'section' | 'document';
  setEditScope: (scope: 'section' | 'document') => void;
  activeSection: { category: string; name: string } | null;
  setActiveSection: (sec: { category: string; name: string } | null) => void;
  discardOpen: boolean;
  setDiscardOpen: (open: boolean) => void;
  editorRef: MutableRefObject<MonacoEditorInstance | null>;
  hasDraft: boolean;
  isDirty: boolean;
  tree: TTree;
  handleEditorChange: (value: string) => void;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  handleDiscard: () => Promise<void>;
  handleEditorMount: (editorInstance: MonacoEditorInstance) => void;
  handleTreeClick: (headingLine: number) => void;
  clearDraft: () => void;
}

export function useMarkdownEntityEditor<
  TTree,
  TSection extends { category: string; name: string } = { category: string; name: string },
>({
  storageKey,
  fetchMarkdown,
  buildTree,
  findSectionAtLine,
}: UseMarkdownEntityEditorOptions<TTree, TSection>): UseMarkdownEntityEditorReturn<TTree> {
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
      storageKey,
    });

  const tree = useMemo(() => buildTree(markdown), [buildTree, markdown]);
  const isDirty = markdown !== savedMarkdown;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchMarkdown()
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
  }, [fetchMarkdown, checkDraft]);

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
      const md = await fetchMarkdown();
      setMarkdown(md);
      setSavedMarkdown(md);
    } catch (e) {
      setError(e instanceof Error ? e.message : '破棄に失敗しました');
    }
  }, [clearDraft, fetchMarkdown]);

  const handleEditorMount = useCallback(
    (editorInstance: MonacoEditorInstance) => {
      editorRef.current = editorInstance;
      editorInstance.onDidChangeCursorPosition((e) => {
        const section = findSectionAtLine(markdown, e.position.lineNumber);
        setActiveSection(section ? { category: section.category, name: section.name } : null);
      });
    },
    [findSectionAtLine, markdown],
  );

  const handleTreeClick = useCallback((headingLine: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    const lineNumber = headingLine + 1;
    ed.revealLineInCenter(lineNumber);
    ed.setPosition({ lineNumber, column: 1 });
    ed.focus();
  }, []);

  return {
    markdown,
    setMarkdown,
    savedMarkdown,
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
    setActiveSection,
    discardOpen,
    setDiscardOpen,
    editorRef,
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
  };
}
