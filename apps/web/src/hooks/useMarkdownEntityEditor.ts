import type { MarkdownCategoryNode } from "@novel-creator/shared";
import type { editor } from "monaco-editor";
import {
  type MutableRefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMarkdownDraft } from "@/hooks/useMarkdownDraft.js";
import { useSidebarResize } from "@/routes/novels/_components/-MarkdownEditorCore.js";

export type MonacoEditorInstance = editor.IStandaloneCodeEditor;

export interface UseMarkdownEntityEditorOptions<
  TTree extends MarkdownCategoryNode[],
  TSection,
> {
  buildTree: (markdown: string) => TTree;
  fetchMarkdown: () => Promise<string>;
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
  storageKey: string;
}

export interface UseMarkdownEntityEditorReturn<
  TTree extends MarkdownCategoryNode[],
  TSection = { category: string; name: string },
> {
  activeSection: TSection | null;
  clearDraft: () => void;
  discardOpen: boolean;
  draftError: string | null;
  editorRef: MutableRefObject<MonacoEditorInstance | null>;
  error: string | null;
  handleDiscard: () => Promise<void>;
  handleDiscardDraft: () => void;
  handleEditorChange: (value: string) => void;
  handleEditorMount: (editorInstance: MonacoEditorInstance) => void;
  handleRestoreDraft: () => void;
  handleSelectionChange: (selectedText: string) => void;
  handleSplitterMouseDown: (e: React.MouseEvent) => void;
  handleTreeClick: (headingLine: number) => void;
  hasDraft: boolean;
  isDirty: boolean;
  isSidebarOpen: boolean;
  loading: boolean;
  markdown: string;
  message: string | null;
  savedMarkdown: string;
  selectedText: string;
  setActiveSection: (sec: TSection | null) => void;
  setDiscardOpen: (open: boolean) => void;
  setError: (err: string | null) => void;
  setIsSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setMarkdown: (value: string) => void;
  setMessage: (msg: string | null) => void;
  setSavedMarkdown: (value: string) => void;
  setSidebarMode: (mode: "pinned" | "overlap") => void;
  setSidebarWidth: (width: number) => void;
  sidebarMode: "pinned" | "overlap";
  sidebarWidth: number;
  toggleSidebar: () => void;
  toggleSidebarMode: () => void;
  tree: TTree;
}

export function useMarkdownEntityEditor<
  TTree extends MarkdownCategoryNode[],
  TSection extends { category: string; name: string } = {
    category: string;
    name: string;
  },
>({
  storageKey,
  fetchMarkdown,
  buildTree,
  findSectionAtLine,
}: UseMarkdownEntityEditorOptions<
  TTree,
  TSection
>): UseMarkdownEntityEditorReturn<TTree, TSection> {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<TSection | null>(null);
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  // 分割幅・リサイズ操作は -MarkdownEditorCore.tsx の useSidebarResize に一本化する。
  const { sidebarWidth, setSidebarWidth, handleSplitterMouseDown } =
    useSidebarResize(256, 160, 600, {
      storageKey: `${storageKey}:sidebar-width`,
    });
  const [sidebarMode, setSidebarModeState] = useState<"pinned" | "overlap">(
    () => {
      const saved = localStorage.getItem(`${storageKey}:sidebar-mode`);
      return saved === "overlap" ? "overlap" : "pinned";
    }
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${storageKey}:sidebar-open`);
    return saved !== null ? saved === "true" : true;
  });

  const setSidebarMode = useCallback(
    (mode: "pinned" | "overlap") => {
      setSidebarModeState(mode);
      localStorage.setItem(`${storageKey}:sidebar-mode`, mode);
      if (mode === "overlap") {
        setIsSidebarOpen(false);
      }
    },
    [storageKey]
  );

  const toggleSidebarMode = useCallback(() => {
    setSidebarMode(sidebarMode === "pinned" ? "overlap" : "pinned");
  }, [setSidebarMode, sidebarMode]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(`${storageKey}:sidebar-open`, String(next));
      return next;
    });
  }, [storageKey]);

  const handleSelectionChange = useCallback((text: string) => {
    setSelectedText(text.trim());
  }, []);

  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;
  const findSectionAtLineRef = useRef(findSectionAtLine);
  findSectionAtLineRef.current = findSectionAtLine;

  const {
    hasDraft,
    draftContent,
    draftError,
    saveDraft,
    clearDraft,
    dismissDraft,
    checkDraft,
  } = useMarkdownDraft({
    storageKey,
    currentContent: savedMarkdown,
  });

  // P5a: ToC用ツリー計算のみ遅延化し、大文書でも入力が詰まらないようにする（worker化はしない）。保存・Dirty・カーソル連動は即時 markdown のまま。
  const deferredMarkdown = useDeferredValue(markdown);
  const tree = useMemo(
    () => buildTree(deferredMarkdown),
    [buildTree, deferredMarkdown]
  );
  const isDirty = markdown !== savedMarkdown;

  const updateActiveSection = useCallback(
    (currentMarkdown?: string, lineNumber?: number) => {
      const ed = editorRef.current;
      const text = currentMarkdown ?? markdownRef.current;
      const line =
        lineNumber !== undefined
          ? lineNumber
          : ed
            ? ed.getPosition()?.lineNumber
            : undefined;
      if (line === undefined || !text) {
        setActiveSection(null);
        return;
      }
      // Monaco の lineNumber は 1-indexed、findSectionAtLine は 0-indexed 行番号を受け取るため - 1 する
      const zeroIndexedLine = Math.max(0, line - 1);
      const section = findSectionAtLineRef.current(text, zeroIndexedLine);
      setActiveSection(section);
    },
    []
  );

  const fetchMarkdownRef = useRef(fetchMarkdown);
  fetchMarkdownRef.current = fetchMarkdown;
  const checkDraftRef = useRef(checkDraft);
  checkDraftRef.current = checkDraft;

  useEffect(() => {
    // storageKey は再実行トリガー（編集対象エンティティの切り替え時に再読み込みする）
    void storageKey;
    let active = true;
    setLoading(true);
    setError(null);
    fetchMarkdownRef
      .current()
      .then((md) => {
        if (!active) {
          return;
        }
        setMarkdown(md);
        setSavedMarkdown(md);
        checkDraftRef.current();
        updateActiveSection(md);
      })
      .catch((e) => {
        if (!active) {
          return;
        }
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey, updateActiveSection]);

  const handleEditorChange = useCallback(
    (value: string) => {
      setMarkdown(value);
      saveDraft(value);
      updateActiveSection(value);
    },
    [saveDraft, updateActiveSection]
  );

  const handleRestoreDraft = useCallback(() => {
    if (draftContent === null) {
      return;
    }
    setMarkdown(draftContent);
    saveDraft(draftContent);
    dismissDraft();
    updateActiveSection(draftContent);
  }, [draftContent, saveDraft, dismissDraft, updateActiveSection]);

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
      updateActiveSection(md);
    } catch (e) {
      setError(e instanceof Error ? e.message : "破棄に失敗しました");
    }
  }, [clearDraft, fetchMarkdown, updateActiveSection]);

  const handleEditorMount = useCallback(
    (editorInstance: MonacoEditorInstance) => {
      editorRef.current = editorInstance;
      editorInstance.onDidChangeCursorPosition((e) => {
        updateActiveSection(markdownRef.current, e.position.lineNumber);
      });
      const pos = editorInstance.getPosition();
      if (pos) {
        updateActiveSection(markdownRef.current, pos.lineNumber);
      }
    },
    [updateActiveSection]
  );

  const handleTreeClick = useCallback(
    (headingLine: number) => {
      const ed = editorRef.current;
      if (!ed) {
        return;
      }
      const lineNumber = headingLine + 1;
      ed.revealLineInCenter(lineNumber);
      ed.setPosition({ lineNumber, column: 1 });
      ed.focus();
      updateActiveSection(markdownRef.current, lineNumber);
    },
    [updateActiveSection]
  );

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
    activeSection,
    setActiveSection,
    discardOpen,
    setDiscardOpen,
    draftError,
    editorRef,
    hasDraft,
    isDirty,
    tree,
    sidebarWidth,
    setSidebarWidth,
    sidebarMode,
    setSidebarMode,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
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
  };
}
