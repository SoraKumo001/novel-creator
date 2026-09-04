import { type RefObject, useCallback, useRef, useState } from "react";

/**
 * アウトライン操作に必要な Monaco エディタの最小面。
 * `MonacoEditorInstance`（IStandaloneCodeEditor）は構造的に満たす。
 */
export interface OutlineEditorHandle {
  focus: () => void;
  getPosition: () => { lineNumber: number } | null;
  revealLineInCenter: (lineNumber: number) => void;
  setPosition: (position: { lineNumber: number; column: number }) => void;
}

export interface UseMarkdownOutlineOptions<TSection> {
  /** Monaco エディタへの ref（マウント前は null） */
  editorRef: RefObject<OutlineEditorHandle | null>;
  /** 行番号（0-indexed）から所属セクションを特定する関数 */
  findSectionAtLine: (markdown: string, lineNumber: number) => TSection | null;
  /** 最新の markdown を同期参照するための ref */
  markdownRef: RefObject<string>;
}

export interface UseMarkdownOutlineReturn<TSection> {
  /** カーソル位置に対応する現在のセクション */
  activeSection: TSection | null;
  /** 目次クリックで該当行へジャンプする（Monaco は 1-indexed のため +1） */
  handleTreeClick: (headingLine: number) => void;
  setActiveSection: (section: TSection | null) => void;
  /** カーソル/本文から activeSection を再計算する */
  updateActiveSection: (currentMarkdown?: string, lineNumber?: number) => void;
}

/**
 * アウトライン（ToC）責務の切り出し。
 * useMarkdownEntityEditor から activeSection の追従・目次ジャンプを分離したもの。
 * 行番号の 0/1-indexed 変換・カーソル購読の挙動は変更しない。
 */
export function useMarkdownOutline<
  TSection extends { category: string; name: string },
>({
  editorRef,
  findSectionAtLine,
  markdownRef,
}: UseMarkdownOutlineOptions<TSection>): UseMarkdownOutlineReturn<TSection> {
  const [activeSection, setActiveSection] = useState<TSection | null>(null);

  const findSectionAtLineRef = useRef(findSectionAtLine);
  findSectionAtLineRef.current = findSectionAtLine;

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
    [editorRef, markdownRef]
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
    [editorRef, markdownRef, updateActiveSection]
  );

  return {
    activeSection,
    setActiveSection,
    updateActiveSection,
    handleTreeClick,
  };
}
