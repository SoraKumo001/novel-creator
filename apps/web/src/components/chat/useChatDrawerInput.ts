import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatFocusContext, QuickPrompt } from "@/context/ChatContext.js";
import {
  chatDraftKey,
  clearChatDraft,
  loadChatDraft,
  saveChatDraft,
} from "@/lib/chat-storage.js";
import { buildChatPromptWithFocus } from "./chatPrompt.js";

export interface UseChatDrawerInputOptions {
  /** エディタから渡された未消費の相談フォーカス */
  chatFocus: ChatFocusContext | null;
  /** 相談フォーカスを消費済みにする */
  consumeFocus: () => void;
  /** 現在のセッションID（下書きキー・送信後削除用） */
  currentSessionId: string | null;
  /** 送信失敗検出用（入力復元トリガー） */
  error: string | null;
  /** 返信中は送信を抑止する */
  isStreaming: boolean;
  /** ストリーミング送信 */
  sendMessage: (content: string) => Promise<void>;
}

export interface UseChatDrawerInputReturn {
  dismissFailedDraft: () => void;
  failedDraft: string | null;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleQuickPrompt: (qp: QuickPrompt) => Promise<void>;
  handleSend: () => Promise<void>;
  handleTextareaInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  input: string;
  /** 履歴/セッション切替前の下書き同期保存（破棄防止用） */
  persistDraftSync: (sessionId: string | null, value: string) => void;
  /** 新規相談開始時の入力初期化（history hook から使う） */
  resetInputForNewChat: () => void;
  restoreFailedDraft: () => void;
  setInput: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * 入力・送信・下書き責務の切り出し。
 * 下書き復元/デバウンス保存（300ms）・送信失敗時の復元を含み、
 * useEffect の発火条件・ガード・debounce条件は変更しない。
 */
export function useChatDrawerInput({
  chatFocus,
  consumeFocus,
  currentSessionId,
  error,
  isStreaming,
  sendMessage,
}: UseChatDrawerInputOptions): UseChatDrawerInputReturn {
  const [input, setInput] = useState("");
  const [failedDraft, setFailedDraft] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSendRef = useRef<string | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const loadedDraftForRef = useRef<string | null>(null);

  // 下書き責務: セッションごとの下書き復元（セッションIDキー）。
  // 実体は `@/lib/chat-storage`。復元順序・ガード条件は変更しない。
  const draftKey = chatDraftKey(currentSessionId);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (loadedDraftForRef.current === draftKey) {
      return;
    }
    loadedDraftForRef.current = draftKey;
    try {
      const saved = loadChatDraft(currentSessionId);
      setInput(saved ?? "");
      setFailedDraft(null);
    } catch {
      // 下書きの読み込み失敗は入力欄を空のままにして続行する
      setInput("");
    }
  }, [draftKey, currentSessionId]);

  // 下書き責務: 下書きのデバウンス保存（300ms）。タイマー管理は変更しない。
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (loadedDraftForRef.current !== draftKey) {
      return;
    }
    if (draftSaveTimerRef.current != null) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      saveChatDraft(currentSessionId, input);
      draftSaveTimerRef.current = null;
    }, 300);
    return () => {
      if (draftSaveTimerRef.current != null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [input, draftKey, currentSessionId]);

  // 送信失敗の検出時は入力復元用に下書きを残す
  useEffect(() => {
    if (error && lastSentRef.current) {
      setFailedDraft((prev) => prev ?? lastSentRef.current);
    }
  }, [error]);

  const restoreFailedDraft = useCallback(() => {
    if (!failedDraft) {
      return;
    }
    setInput(failedDraft);
    setFailedDraft(null);
    lastSentRef.current = null;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [failedDraft]);

  const dismissFailedDraft = useCallback(() => {
    setFailedDraft(null);
    lastSentRef.current = null;
  }, []);

  // 送信ハンドラ（成功確定まで原文を保持し、失敗時は復元できるようにする）
  const handleSend = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    // 返信中は追記メモとして入力を保持し、返信後に送信できるようにする
    if (isStreaming) {
      return;
    }
    const text = input;
    pendingSendRef.current = text;
    lastSentRef.current = text;
    setFailedDraft(null);
    const finalPrompt = buildChatPromptWithFocus(text, chatFocus);
    if (chatFocus) {
      consumeFocus();
    }
    try {
      await sendMessage(finalPrompt);
      pendingSendRef.current = null;
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      try {
        if (typeof window !== "undefined") {
          clearChatDraft(currentSessionId);
        }
      } catch {
        // 下書きの削除失敗は無視する
      }
    } catch {
      // 送信に失敗した場合は入力欄に戻せるよう原文を残す
      setFailedDraft(text);
      pendingSendRef.current = null;
    }
  }, [
    input,
    isStreaming,
    chatFocus,
    consumeFocus,
    sendMessage,
    currentSessionId,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickPrompt = useCallback(
    async (qp: QuickPrompt) => {
      if (isStreaming) {
        return;
      }
      await sendMessage(qp.prompt);
    },
    [sendMessage, isStreaming]
  );

  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const target = e.target;
      target.style.height = "auto";
      target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
    },
    []
  );

  // 下書き責務: 切り替え前の入力を同期保存する（確認ダイアログ後の破棄防止用）
  const persistDraftSync = useCallback(
    (sessionId: string | null, value: string) => {
      saveChatDraft(sessionId, value);
    },
    []
  );

  // 新規相談開始時の入力初期化（入力 state の所有はこの hook に留める）
  const resetInputForNewChat = useCallback(() => {
    setInput("");
    loadedDraftForRef.current = chatDraftKey(null);
    setFailedDraft(null);
    lastSentRef.current = null;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  return {
    dismissFailedDraft,
    failedDraft,
    handleKeyDown,
    handleQuickPrompt,
    handleSend,
    handleTextareaInput,
    input,
    persistDraftSync,
    resetInputForNewChat,
    restoreFailedDraft,
    setInput,
    textareaRef,
  };
}
