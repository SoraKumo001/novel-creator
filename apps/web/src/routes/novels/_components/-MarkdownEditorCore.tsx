import type { MarkdownCategoryNode } from "@novel-creator/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button.js";
import {
  usePersistedState,
  useSidebarResize,
} from "@/hooks/useEditorSidebar.js";
import type { MarkdownInsertKind } from "@/hooks/useMarkdownEntityEditor.js";
import { useMarkdownExternalSync } from "@/hooks/useMarkdownExternalSync.js";

export type { MarkdownPreviewMode } from "@/lib/editor-storage.js";
export { MarkdownPreviewDock } from "./-MarkdownPreviewDock.js";
/**
 * Markdown編集系で重複していたサイドバー/ツールバー/ショートカットの共通コア。
 * routes 配下のみで完結する presentational な集約（API・hooks・context は触らない）。
 *
 * 状態系フック（useSidebarResize / usePersistedState / useMarkdownExternalSync）は
 * `@/hooks` へ移動した。既存の import パスを維持するためここで再エクスポートする。
 */
export { useMarkdownExternalSync, usePersistedState, useSidebarResize };

export function useOverlapHover(onClose?: () => void) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
      setIsOpen(false);
      onClose?.();
    }, 250);
  }, [onClose]);

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    },
    []
  );

  const showOverlap = isOpen || isHovered;
  return {
    isHovered,
    isOpen,
    setIsOpen,
    showOverlap,
    handleMouseEnter,
    handleMouseLeave,
  };
}

export function useEditorSaveShortcut(options: {
  canSave: boolean;
  canFormat?: boolean;
  isBusy: boolean;
  onSave: () => void;
  onFormat?: () => void;
}) {
  const { canSave, canFormat, isBusy, onSave, onFormat } = options;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const formatRef = useRef(onFormat);
  formatRef.current = onFormat;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSave && !isBusy) {
          void saveRef.current();
        }
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (canFormat && !isBusy) {
          formatRef.current?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSave, canFormat, isBusy]);
}

/**
 * 挿入ショートカット最小セット。既存の Ctrl+S（保存）/ Shift+Alt+F（整形）と重複させない。
 * エディタフォーカス時のみ有効化し、IME 変換中（isComposing）は発火させない。
 */
export const MARKDOWN_INSERT_BUTTONS: {
  kind: MarkdownInsertKind;
  label: string;
  title: string;
}[] = [
  { kind: "bold", label: "B", title: "太字 (Ctrl+B)" },
  { kind: "italic", label: "I", title: "斜体 (Ctrl+I)" },
  { kind: "strike", label: "S", title: "取消線 (Ctrl+Shift+X)" },
  { kind: "heading", label: "H", title: "見出し (Ctrl+Shift+H)" },
  { kind: "link", label: "🔗", title: "リンク (Ctrl+K)" },
  { kind: "quote", label: "❝", title: "引用 (Ctrl+Shift+Q)" },
  { kind: "ruby", label: "ルビ", title: "ルビ |漢字《よみ》 (Ctrl+Shift+R)" },
  { kind: "bouten", label: "傍点", title: "傍点 《《》》 (Ctrl+Shift+E)" },
];

export function MarkdownInsertButtons({
  onInsert,
  disabled,
}: {
  onInsert: (kind: MarkdownInsertKind) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="toolbar"
      aria-label="書式挿入"
    >
      {MARKDOWN_INSERT_BUTTONS.map((b) => (
        <button
          key={b.kind}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(b.kind)}
          title={b.title}
          aria-label={b.title}
          className="min-w-7 cursor-pointer rounded-md border border-border bg-surface px-1.5 py-1 text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function useMarkdownInsertShortcut(options: {
  enabled: boolean;
  isEditorFocused: () => boolean;
  onInsert: (kind: MarkdownInsertKind) => void;
}) {
  const { enabled, isEditorFocused, onInsert } = options;
  const insertRef = useRef(onInsert);
  insertRef.current = onInsert;
  const focusRef = useRef(isEditorFocused);
  focusRef.current = isEditorFocused;
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 変換中は Monaco・IME と競合させない
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) {
        return;
      }
      if (!focusRef.current()) {
        return;
      }
      const key = e.key.toLowerCase();
      let kind: MarkdownInsertKind | null = null;
      if (!e.shiftKey) {
        if (key === "b") {
          kind = "bold";
        } else if (key === "i") {
          kind = "italic";
        } else if (key === "k") {
          kind = "link";
        }
      } else if (key === "x") {
        kind = "strike";
      } else if (key === "h") {
        kind = "heading";
      } else if (key === "q") {
        kind = "quote";
      } else if (key === "r") {
        kind = "ruby";
      } else if (key === "e") {
        kind = "bouten";
      }
      if (!kind) {
        return;
      }
      e.preventDefault();
      insertRef.current(kind);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}

export function MarkdownDraftBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-amber-500/30 border-b bg-amber-500/10 px-4 py-2 text-amber-900 text-sm dark:text-amber-200"
      role="region"
      aria-label="自動保存されたドラフト"
    >
      <span>未保存のドラフトがあります。復元しますか？</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRestore}>
          復元する
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          破棄する
        </Button>
      </div>
    </div>
  );
}

export function MarkdownToolbarRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-surface px-4 py-2">
      <div className="flex items-center gap-2">{left}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function TocToggleButton({
  active,
  onToggle,
  onMouseEnter,
}: {
  active: boolean;
  onToggle: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onMouseEnter}
      title="目次サイドバーを開閉"
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        active
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
  );
}

export function EditorSidebarShell({
  mode,
  sidebarWidth,
  onSplitterMouseDown,
  onToggleMode,
  onStripEnter,
  onStripLeave,
  onStripClick,
  onPanelEnter,
  onPanelLeave,
  showOverlap,
  renderToc,
}: {
  mode: "pinned" | "overlap";
  sidebarWidth: number;
  onSplitterMouseDown: (e: React.MouseEvent) => void;
  onToggleMode: () => void;
  onStripEnter: () => void;
  onStripLeave: () => void;
  onStripClick: () => void;
  onPanelEnter: () => void;
  onPanelLeave: () => void;
  showOverlap: boolean;
  renderToc: () => React.ReactNode;
}) {
  if (mode === "pinned") {
    return (
      <>
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 overflow-y-auto border-border border-r bg-surface p-2 text-xs"
        >
          {renderToc()}
        </aside>
        <div
          onMouseDown={onSplitterMouseDown}
          className="z-10 -ml-0.5 w-1.5 shrink-0 cursor-col-resize select-none bg-border transition-colors hover:w-2 hover:bg-primary/50"
          title="ドラッグして幅を調整"
        />
      </>
    );
  }
  return (
    <>
      <div
        onMouseEnter={onStripEnter}
        onMouseLeave={onStripLeave}
        onClick={onStripClick}
        className="group z-10 flex w-7 shrink-0 cursor-pointer flex-col items-center border-border border-r bg-surface/80 py-3 text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
        title="マウスホバーで目次を展開"
      >
        <span className="text-xs">📑</span>
        <span className="mt-2 font-medium text-[10px] tracking-widest opacity-70 [writing-mode:vertical-rl] group-hover:opacity-100">
          目次
        </span>
      </div>
      {showOverlap && (
        <div
          onMouseEnter={onPanelEnter}
          onMouseLeave={onPanelLeave}
          className="absolute top-0 bottom-0 left-7 z-30 flex shadow-2xl"
        >
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="slide-in-from-left flex animate-in flex-col overflow-y-auto border-border border-r bg-surface/98 p-2 text-xs backdrop-blur-md duration-150"
          >
            {renderToc()}
          </aside>
        </div>
      )}
      <span className="hidden">
        <button
          type="button"
          onClick={onToggleMode}
          aria-label="目次表示切替"
        />
      </span>
    </>
  );
}

export function TocHeader({
  title,
  mode,
  onToggleMode,
}: {
  title: string;
  mode: "pinned" | "overlap";
  onToggleMode: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between border-border border-b px-1 pb-1.5 font-semibold text-muted-foreground text-xs">
      <span className="truncate font-bold text-foreground" title={title}>
        目次
      </span>
      <button
        type="button"
        onClick={onToggleMode}
        title={
          mode === "pinned" ? "オーバーラップ表示に切替" : "ピン留め表示に切替"
        }
        className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        {mode === "pinned" ? "📌" : "🔓"}
      </button>
    </div>
  );
}

// プレビュー表示部は ./-MarkdownPreviewDock.tsx へ分離。
// 既存の import パス維持のため、このファイルの先頭で再エクスポートする。

export function SelectionConsultBar({
  selectedText,
  label,
  onConsult,
}: {
  selectedText: string;
  label: string;
  onConsult: () => void;
}) {
  if (!selectedText) {
    return null;
  }
  return (
    <div className="fade-in slide-in-from-top-1 absolute top-4 right-8 z-30 animate-in duration-150">
      <button
        type="button"
        onClick={onConsult}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/20 bg-primary px-3.5 py-1.5 font-bold text-primary-foreground text-xs shadow-lg transition hover:brightness-110"
      >
        <span>
          💬 {label} ({selectedText.length}文字)
        </span>
      </button>
    </div>
  );
}

export function scrollToElementById(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function MarkdownTocNav({
  tree,
  activeCategory,
  activeName,
  onJump,
}: {
  tree: MarkdownCategoryNode[];
  activeCategory?: string;
  activeName?: string;
  onJump: (headingLine: number) => void;
}) {
  if (tree.length === 0) {
    return (
      <div className="py-2 text-center text-muted-foreground text-xs">
        見出しがありません
      </div>
    );
  }
  return (
    <>
      {tree.map((cat) => (
        <div key={cat.category} className="space-y-0.5">
          <div
            className="cursor-pointer truncate px-2 py-1 font-semibold text-muted-foreground text-xs hover:text-foreground"
            onClick={() => onJump(cat.headingLine)}
            title={cat.category}
          >
            {cat.category}
          </div>
          <div className="ml-2 space-y-0.5 border-border border-l pl-2">
            {cat.children.map((item) => (
              <div
                key={`${cat.category}-${item.name}-${item.headingLine}`}
                className={`cursor-pointer truncate rounded px-2 py-0.5 text-xs transition-colors ${
                  activeName === item.name && activeCategory === cat.category
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-foreground hover:bg-surface-hover"
                }`}
                onClick={() => onJump(item.headingLine)}
                title={item.name}
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
