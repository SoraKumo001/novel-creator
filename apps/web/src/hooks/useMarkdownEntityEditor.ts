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

/** 挿入ショートカット最小セット。Monaco既定・IMEと競合しない範囲に限定する。 */
export type MarkdownInsertKind =
  | "bold"
  | "italic"
  | "strike"
  | "link"
  | "quote"
  | "heading"
  | "ruby"
  | "bouten";

export interface MarkdownInsertResult {
  selectionEnd: number;
  selectionStart: number;
  text: string;
}

function clampOffset(value: number, length: number): number {
  return Math.max(0, Math.min(length, Math.floor(value)));
}

function wrapWith(
  text: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder: string
): MarkdownInsertResult {
  const selected = text.slice(start, end);
  if (selected) {
    // 選択範囲を wrap し、選択自体は維持する
    return {
      text: text.slice(0, start) + prefix + selected + suffix + text.slice(end),
      selectionStart: start + prefix.length,
      selectionEnd: start + prefix.length + selected.length,
    };
  }
  return {
    text:
      text.slice(0, start) + prefix + placeholder + suffix + text.slice(end),
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + placeholder.length,
  };
}

function lineBounds(
  text: string,
  offset: number
): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const next = text.indexOf("\n", offset);
  return { lineStart, lineEnd: next === -1 ? text.length : next };
}

function prefixLines(
  text: string,
  start: number,
  end: number,
  prefix: string,
  placeholder: string,
  isPrefixed: (line: string) => boolean
): MarkdownInsertResult {
  // 未選択時はカーソル行のみ操作する
  if (start === end) {
    const { lineStart, lineEnd } = lineBounds(text, start);
    const line = text.slice(lineStart, lineEnd);
    if (line.length === 0) {
      const inserted = prefix + placeholder;
      return {
        text: text.slice(0, lineStart) + inserted + text.slice(lineEnd),
        selectionStart: lineStart + prefix.length,
        selectionEnd: lineStart + prefix.length + placeholder.length,
      };
    }
    if (isPrefixed(line)) {
      return { text, selectionStart: start, selectionEnd: end };
    }
    return {
      text: text.slice(0, lineStart) + prefix + line + text.slice(lineEnd),
      selectionStart: start + prefix.length,
      selectionEnd: end + prefix.length,
    };
  }
  // 選択範囲に触れた行全体へ付与する（末尾が行頭ちょうどの場合はその行を除く）
  const first = lineBounds(text, start);
  const adjustedEnd = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const last = lineBounds(text, adjustedEnd);
  const segment = text.slice(first.lineStart, last.lineEnd);
  const converted = segment
    .split("\n")
    .map((line) =>
      line.length === 0 || isPrefixed(line) ? line : prefix + line
    )
    .join("\n");
  return {
    text: text.slice(0, first.lineStart) + converted + text.slice(last.lineEnd),
    selectionStart: first.lineStart,
    selectionEnd: first.lineStart + converted.length,
  };
}

/**
 * 選択範囲 wrap・未選択時はスニペット挿入を行う純粋関数。
 * ルビ/傍点記法は packages/shared の ruby.ts と同一形式にする。
 */
export function applyMarkdownInsert(
  base: string,
  rawStart: number,
  rawEnd: number,
  kind: MarkdownInsertKind
): MarkdownInsertResult {
  const text = base ?? "";
  const lo = clampOffset(Math.min(rawStart, rawEnd), text.length);
  const hi = clampOffset(Math.max(rawStart, rawEnd), text.length);
  switch (kind) {
    case "bold":
      return wrapWith(text, lo, hi, "**", "**", "太字");
    case "italic":
      return wrapWith(text, lo, hi, "*", "*", "斜体");
    case "strike":
      return wrapWith(text, lo, hi, "~~", "~~", "取消線");
    case "link": {
      const selected = text.slice(lo, hi);
      const url = "https://example.com";
      if (selected) {
        return {
          text: `${text.slice(0, lo)}[${selected}](${url})${text.slice(hi)}`,
          selectionStart: lo + selected.length + 3,
          selectionEnd: lo + selected.length + 3 + url.length,
        };
      }
      const label = "リンクテキスト";
      return {
        text: `${text.slice(0, lo)}[${label}](${url})${text.slice(hi)}`,
        selectionStart: lo + 1,
        selectionEnd: lo + 1 + label.length,
      };
    }
    case "quote":
      return prefixLines(text, lo, hi, "> ", "引用文", (line) =>
        line.startsWith(">")
      );
    case "heading":
      return prefixLines(text, lo, hi, "## ", "見出し", (line) =>
        /^#{1,6}\s/.test(line)
      );
    case "ruby": {
      const selected = text.slice(lo, hi);
      if (selected) {
        const reading = "よみ";
        return {
          text: `${text.slice(0, lo)}|${selected}《${reading}》${text.slice(hi)}`,
          selectionStart: lo + selected.length + 2,
          selectionEnd: lo + selected.length + 2 + reading.length,
        };
      }
      const baseText = "テキスト";
      const reading = "よみ";
      return {
        text: `${text.slice(0, lo)}|${baseText}《${reading}》${text.slice(hi)}`,
        selectionStart: lo + 1,
        selectionEnd: lo + 1 + baseText.length,
      };
    }
    case "bouten":
      return wrapWith(text, lo, hi, "《《", "》》", "強調");
    default:
      return { text, selectionStart: lo, selectionEnd: hi };
  }
}

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
  insertMarkdown: (kind: MarkdownInsertKind) => void;
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

  // 挿入操作は Monaco の単一 edit として適用する。onChange 経由で保存・Dirty・ToC・ドラフトが追従する。
  const insertMarkdown = useCallback((kind: MarkdownInsertKind) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) {
      return;
    }
    const selection = ed.getSelection();
    if (!selection) {
      return;
    }
    const value = model.getValue();
    const start = model.getOffsetAt(selection.getStartPosition());
    const end = model.getOffsetAt(selection.getEndPosition());
    const applied = applyMarkdownInsert(value, start, end, kind);
    ed.executeEdits("markdown-insert", [
      { range: model.getFullModelRange(), text: applied.text },
    ]);
    const anchor = model.getPositionAt(applied.selectionStart);
    const cursor = model.getPositionAt(applied.selectionEnd);
    ed.setSelection({
      positionColumn: cursor.column,
      positionLineNumber: cursor.lineNumber,
      selectionStartColumn: anchor.column,
      selectionStartLineNumber: anchor.lineNumber,
    });
    ed.focus();
  }, []);

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
    insertMarkdown,
    handleSplitterMouseDown,
    selectedText,
    handleSelectionChange,
    clearDraft,
  };
}
