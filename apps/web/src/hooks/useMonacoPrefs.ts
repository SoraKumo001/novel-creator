import { useCallback, useState } from "react";
import {
  clampMonacoFontSize,
  loadMonacoFontSize,
  loadMonacoWordWrap,
  type MonacoWordWrap,
  saveMonacoFontSize,
  saveMonacoWordWrap,
} from "@/lib/editor-storage.js";

export interface UseMonacoPrefsReturn {
  /** エディタ文字サイズ（10〜24、既定 15） */
  editorFontSize: number;
  /** 行折返し設定（既定 "on"） */
  editorWordWrap: MonacoWordWrap;
  /** 文字サイズを増減する（範囲外はクランプし、永続化する） */
  handleEditorFontSize: (delta: number) => void;
  /** 折返し表示を切替える（永続化する） */
  handleToggleWordWrap: () => void;
}

/**
 * Monaco 最小設定（文字サイズ・折返し）の単一実装。
 * -EntityMarkdownEditor に重複していた永続化（`:monaco-font-size` /
 * `:monaco-word-wrap`）をここに統一する。実体は `@/lib/editor-storage`。
 * 既定は従来表示（15 / on）のまま。公開 state・ハンドラ名は維持する。
 */
export function useMonacoPrefs(storageKey: string): UseMonacoPrefsReturn {
  const [editorFontSize, setEditorFontSize] = useState<number>(() =>
    loadMonacoFontSize(storageKey)
  );
  const [editorWordWrap, setEditorWordWrap] = useState<MonacoWordWrap>(() =>
    loadMonacoWordWrap(storageKey)
  );

  const handleEditorFontSize = useCallback(
    (delta: number) => {
      setEditorFontSize((prev) => {
        const next = clampMonacoFontSize(prev + delta);
        saveMonacoFontSize(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const handleToggleWordWrap = useCallback(() => {
    setEditorWordWrap((prev) => {
      const next: MonacoWordWrap = prev === "on" ? "off" : "on";
      saveMonacoWordWrap(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return {
    editorFontSize,
    editorWordWrap,
    handleEditorFontSize,
    handleToggleWordWrap,
  };
}
