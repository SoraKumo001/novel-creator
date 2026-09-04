import type { MarkdownCategoryNode } from "@novel-creator/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button.js";
import { useToast } from "@/hooks/useToast.js";

/**
 * Markdown編集系で重複していたサイドバー/ツールバー/ショートカットの共通コア。
 * routes 配下のみで完結する presentational な集約（API・hooks・context は触らない）。
 */

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

/**
 * サイドバー分割幅・リサイズ操作の単一実装。
 * useMarkdownEntityEditor 側の重複実装は廃止し、こちらに寄せている。
 * storageKey 指定時のみ localStorage に永続化する（未指定時は従来通り state のみ）。
 */
export function useSidebarResize(
  initialWidth = 256,
  min = 160,
  max = 500,
  options?: { storageKey?: string }
) {
  const storageKey = options?.storageKey;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          return Number.parseInt(saved, 10);
        }
      } catch {
        // storage 利用不可時は初期値
      }
    }
    return initialWidth;
  });
  const isDraggingRef = useRef(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const startX = e.clientX;
      const startWidth = sidebarWidthRef.current;
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) {
          return;
        }
        const delta = moveEvent.clientX - startX;
        setSidebarWidth(Math.max(min, Math.min(max, startWidth + delta)));
      };
      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (storageKey) {
          setSidebarWidth((current) => {
            try {
              localStorage.setItem(storageKey, String(current));
            } catch {
              // storage 利用不可時は state のみ維持
            }
            return current;
          });
        }
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [min, max, storageKey]
  );

  return { sidebarWidth, setSidebarWidth, handleSplitterMouseDown };
}

export function usePersistedState<T extends string>(
  storageKey: string,
  initialValue: T
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return (saved as T) || initialValue;
    } catch {
      return initialValue;
    }
  });
  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // storage 利用不可時は state のみ更新
      }
    },
    [storageKey]
  );
  return [value, setAndPersist] as const;
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

export function useMarkdownExternalSync(options: {
  novelId: string;
  entityTitle: string;
  entityType: string;
  setMarkdown: (markdown: string) => void;
  setSavedMarkdown: (markdown: string) => void;
  clearDraft: () => void;
}) {
  const {
    novelId,
    entityTitle,
    entityType,
    setMarkdown,
    setSavedMarkdown,
    clearDraft,
  } = options;
  const toast = useToast();

  useEffect(() => {
    const eventNameMap: Record<string, string> = {
      characters_markdown: "novel-creator:characters-updated",
      settings_markdown: "novel-creator:settings-updated",
      foreshadowings_document: "novel-creator:foreshadowings-updated",
      foreshadowings_markdown: "novel-creator:foreshadowings-updated",
      story_outline_markdown: "novel-creator:story-outline-updated",
      timelines_markdown: "novel-creator:timelines-updated",
      plot_markdown: "novel-creator:plot-updated",
    };
    const targetEventName = eventNameMap[entityType];
    if (!targetEventName) {
      return;
    }
    const handleExternalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        appliedSection?: string;
        appliedTitle?: string;
        markdown: string;
        novelId: string;
      }>;
      if (!customEvent.detail || customEvent.detail.novelId !== novelId) {
        return;
      }
      const {
        markdown: newMarkdown,
        appliedSection,
        appliedTitle,
      } = customEvent.detail;
      setMarkdown(newMarkdown);
      setSavedMarkdown(newMarkdown);
      clearDraft();
      toast.success(
        `チャットからの提案（${appliedSection || appliedTitle || entityTitle}）をエディタに同期しました`
      );
    };
    window.addEventListener(targetEventName, handleExternalUpdate);
    return () => {
      window.removeEventListener(targetEventName, handleExternalUpdate);
    };
  }, [
    clearDraft,
    entityTitle,
    entityType,
    novelId,
    setMarkdown,
    setSavedMarkdown,
    toast,
  ]);

  useEffect(() => {
    const handlePreviewApply = (event: Event) => {
      const customEvent = event as CustomEvent<{
        novelId: string;
        entityType: string;
        markdown: string;
        appliedTitle?: string;
      }>;
      if (
        !customEvent.detail ||
        customEvent.detail.novelId !== novelId ||
        customEvent.detail.entityType !== entityType
      ) {
        return;
      }
      const { markdown: newMarkdown, appliedTitle } = customEvent.detail;
      setMarkdown(newMarkdown);
      toast.success(
        `チャットの提案内容（${appliedTitle || entityTitle}）をエディタに読み込みました。差分を確認・調整して保存してください。`
      );
    };
    window.addEventListener(
      "novel-creator:markdown-preview-apply",
      handlePreviewApply
    );
    return () => {
      window.removeEventListener(
        "novel-creator:markdown-preview-apply",
        handlePreviewApply
      );
    };
  }, [entityTitle, entityType, novelId, setMarkdown, toast]);
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
