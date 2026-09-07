import { type RefObject, useEffect, useRef } from "react";
import type { ChatFocusContext } from "@/context/chatUiTypes.js";

export interface UseChatDrawerFocusOptions {
  /** エディタから渡された未消費の相談フォーカス */
  chatFocus: ChatFocusContext | null;
  /** ドロワーを閉じる（Esc ハンドラ用） */
  closeChat: () => void;
  /** overlay / full 時にダイアログ振る舞い（Esc で閉じる） */
  isDialog: boolean;
  /** ドロワー開閉状態 */
  isOpen: boolean;
  /** 入力欄 ref */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * フォーカス管理責務の切り出し（入力欄フォーカス・Esc・フォーカス復帰）。
 * 副作用のみのため戻り値は void（useMarkdownExternalSync と同一パターン）。
 * useEffect の発火条件・ガードは変更しない。
 */
export function useChatDrawerFocus({
  chatFocus,
  closeChat,
  isDialog,
  isOpen,
  textareaRef,
}: UseChatDrawerFocusOptions): void {
  const previouslyFocusedRef = useRef<Element | null>(null);

  // エディタからの「AIと相談」フォーカスが渡されたら入力欄にフォーカスする。
  useEffect(() => {
    if (!isOpen || !chatFocus) {
      return;
    }
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [isOpen, chatFocus, textareaRef]);

  // overlay / full 時は Esc で閉じる
  useEffect(() => {
    if (!isOpen || !isDialog) {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeChat();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, isDialog, closeChat]);

  // 開いたときにフォーカス位置を記憶し、閉じたときに返す
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
    } else {
      const el = previouslyFocusedRef.current as HTMLElement | null;
      previouslyFocusedRef.current = null;
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    }
  }, [isOpen]);
}
