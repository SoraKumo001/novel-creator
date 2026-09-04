import { useCallback, useRef, useState } from "react";
import { readEditorSetting, writeEditorSetting } from "@/lib/editor-storage.js";

/**
 * サイドバー分割幅・リサイズ操作の単一実装。
 * -MarkdownEditorCore からの移動（既存の import パスを維持するため
 * Core 側で再エクスポートする）。storageKey 指定時のみ永続化し、
 * 未指定時は従来通り state のみ。実体は `@/lib/editor-storage`。
 * 挙動は変更しない。
 */
export function useSidebarResize(
  initialWidth = 256,
  min = 160,
  max = 500,
  options?: { storageKey?: string }
): {
  handleSplitterMouseDown: (e: React.MouseEvent) => void;
  setSidebarWidth: (width: number) => void;
  sidebarWidth: number;
} {
  const storageKey = options?.storageKey;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (storageKey) {
      const saved = readEditorSetting(storageKey);
      if (saved) {
        return Number.parseInt(saved, 10);
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
            writeEditorSetting(storageKey, String(current));
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

/**
 * 文字列設定の永続化 state（プレビューモード等）。
 * -MarkdownEditorCore からの移動（Core 側で再エクスポートする）。
 * 実体は `@/lib/editor-storage`。挙動は変更しない。
 */
export function usePersistedState<T extends string>(
  storageKey: string,
  initialValue: T
): readonly [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const saved = readEditorSetting(storageKey);
    return (saved as T) || initialValue;
  });
  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      writeEditorSetting(storageKey, next);
    },
    [storageKey]
  );
  return [value, setAndPersist] as const;
}
