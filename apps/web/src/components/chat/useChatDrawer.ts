import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type ChatFocusContext,
  type QuickPrompt,
  useChatStreamingState,
  useChatUI,
} from "@/context/ChatContext.js";
import { useNovels } from "@/hooks/useNovels.js";
import { usePinnedSessions } from "@/hooks/usePinnedSessions.js";
import { useToast } from "@/hooks/useToast.js";
import { buildChatPromptWithFocus } from "./chatPrompt.js";

export type DrawerWidth = "normal" | "wide" | "full";
export type ChatLayoutMode = "overlay" | "docked";

const DRAFT_PREFIX = "novel-creator:chat-draft:";

function draftKeyFor(sessionId: string | null): string {
  return `${DRAFT_PREFIX}${sessionId ?? "new"}`;
}

interface UseChatDrawerResult {
  abortStream: () => void;
  chatFocus: ChatFocusContext | null;
  clearError: () => void;
  closeChat: () => void;
  consumeFocus: () => void;
  copiedId: string | null;
  copyNotice: string | null;
  currentNovelTitle: string | null;
  currentSession: { id: string; title: string } | null;
  currentSessionId: string | null;
  deleteSession: (sessionId: string) => Promise<void>;
  dismissFailedDraft: () => void;
  drawerWidth: DrawerWidth;
  error: string | null;
  failedDraft: string | null;
  handleCopy: (content: string, id: string) => Promise<void>;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleLayoutModeChange: (mode: ChatLayoutMode) => void;
  handleMessagesScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleModelChange: (id: string | null) => void;
  handleNovelChange: (id: string | null) => void;
  handleQuickPrompt: (qp: QuickPrompt) => Promise<void>;
  handleSelectSession: (id: string) => void;
  handleSend: () => Promise<void>;
  handleStartNewChat: () => void;
  handleTextareaInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleWidthChange: (width: DrawerWidth) => void;
  input: string;
  isDialog: boolean;
  isOpen: boolean;
  isPinnedToBottom: boolean;
  isStreaming: boolean;
  lastPrompt: string | null;
  layoutMode: ChatLayoutMode;
  loadingMessages: boolean;
  messages: ReturnType<typeof useChatStreamingState>["messages"];
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  novels: ReturnType<typeof useNovels>["novels"];
  onDeleteSession: (id: string) => Promise<void>;
  onSaveTitle: (id: string, newTitle: string) => Promise<boolean>;
  pinnedIds: Set<string>;
  progress: ReturnType<typeof useChatStreamingState>["progress"];
  restoreFailedDraft: () => void;
  retryLastMessage: () => Promise<void>;
  scrollToBottom: () => void;
  selectedModelConfigId: string | null;
  selectedNovelId: string | null;
  sessions: ReturnType<typeof useChatUI>["sessions"];
  setInput: (v: string) => void;
  setSelectedModelConfigId: (id: string | null) => void;
  setSelectedNovelId: (id: string | null) => void;
  setShowHistoryView: (v: boolean | ((prev: boolean) => boolean)) => void;
  showHistoryView: boolean;
  showJumpButton: boolean;
  streamingContent: string;
  streamingParts: ReturnType<typeof useChatStreamingState>["streamingParts"];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  togglePin: (id: string) => void;
}

/**
 * ChatDrawer の振る舞い（入力・送信・スクロール追従・幅/配置・履歴操作）を集約する hook。
 * 描画は ChatDrawer 側に残し、ここでは状態遷移とイベントハンドラのみを提供する。
 * 下書き保存・追従停止・破棄防止などの UI 層の配慮はこのファイルで完結させる。
 */
export function useChatDrawer(): UseChatDrawerResult {
  const {
    isOpen,
    closeChat,
    chatFocus,
    consumeFocus,
    selectedNovelId,
    setSelectedNovelId,
    selectedModelConfigId,
    setSelectedModelConfigId,
    sessions,
    currentSessionId,
    currentSession,
    loadingMessages,
    startNewChat,
    selectSession,
    deleteSession,
    updateSessionTitle,
  } = useChatUI();

  const {
    messages,
    isStreaming,
    streamingContent,
    streamingParts,
    progress,
    error,
    lastPrompt,
    sendMessage,
    retryLastMessage,
    clearError,
    abortStream,
  } = useChatStreamingState();

  const { novels } = useNovels();
  const toast = useToast();

  const [drawerWidth, setDrawerWidth] = useState<DrawerWidth>(
    () =>
      (localStorage.getItem("novel-creator:chat-width") as DrawerWidth) ||
      "normal"
  );
  const [layoutMode, setLayoutMode] = useState<ChatLayoutMode>(
    () =>
      (localStorage.getItem(
        "novel-creator:chat-layout-mode"
      ) as ChatLayoutMode) || "docked"
  );
  const { pinnedIds, togglePin } = usePinnedSessions();

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const pendingSendRef = useRef<string | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const loadedDraftForRef = useRef<string | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  const isDialog = layoutMode === "overlay" || drawerWidth === "full";
  const showJumpButton = !isPinnedToBottom;

  const handleWidthChange = useCallback((width: DrawerWidth) => {
    setDrawerWidth(width);
    localStorage.setItem("novel-creator:chat-width", width);
  }, []);

  const handleLayoutModeChange = useCallback((mode: ChatLayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem("novel-creator:chat-layout-mode", mode);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) {
      return;
    }
    isUserScrolledUpRef.current = false;
    setIsPinnedToBottom(true);
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
      isUserScrolledUpRef.current = !isAtBottom;
      setIsPinnedToBottom(isAtBottom);
    },
    []
  );

  // チャットオープン時や履歴切り替え時の初期スクロール & フォーカス
  useEffect(() => {
    if (isOpen && !showHistoryView) {
      isUserScrolledUpRef.current = false;
      setIsPinnedToBottom(true);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
      textareaRef.current?.focus();
    }
  }, [isOpen, showHistoryView]);

  // 新規メッセージ追加時のスクロール（遡読中は追従しない）
  useEffect(() => {
    // messages.length は再実行トリガー（新規メッセージ追加時に末尾へスクロールする）
    void messages.length;
    if (isOpen && !showHistoryView && !isUserScrolledUpRef.current) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messages.length, isOpen, showHistoryView]);

  // ストリーミング中の自動スクロール追従（追従停止中は止める）
  useEffect(() => {
    // streamingContent / streamingParts は再実行トリガー（チャンク受信ごとに追従する）
    void streamingContent;
    void streamingParts;
    if (!isStreaming || isUserScrolledUpRef.current) {
      return;
    }
    if (scrollRafRef.current == null) {
      scrollRafRef.current = requestAnimationFrame(() => {
        if (messagesContainerRef.current && !isUserScrolledUpRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
        scrollRafRef.current = null;
      });
    }
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [streamingContent, streamingParts, isStreaming]);

  // エディタからの「AIと相談」フォーカスが渡されたら入力欄にフォーカスする。
  useEffect(() => {
    if (!isOpen || !chatFocus) {
      return;
    }
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [isOpen, chatFocus]);

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

  // セッションごとの下書き復元（セッションIDキー）
  const draftKey = draftKeyFor(currentSessionId);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (loadedDraftForRef.current === draftKey) {
      return;
    }
    loadedDraftForRef.current = draftKey;
    try {
      const saved = localStorage.getItem(draftKey);
      setInput(saved ?? "");
      setFailedDraft(null);
    } catch {
      // 下書きの読み込み失敗は入力欄を空のままにして続行する
      setInput("");
    }
  }, [draftKey]);

  // 下書きのデバウンス保存（300ms）
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
      try {
        if (input) {
          localStorage.setItem(draftKey, input);
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch {
        // 保存失敗時は無視する（下書きなしとして続行）
      }
      draftSaveTimerRef.current = null;
    }, 300);
    return () => {
      if (draftSaveTimerRef.current != null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [input, draftKey]);

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
          localStorage.removeItem(draftKeyFor(currentSessionId));
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

  const handleCopy = useCallback(
    async (content: string, id: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setCopyNotice("メッセージをコピーしました");
        toast.success("メッセージをコピーしました");
        window.setTimeout(() => {
          setCopiedId(null);
          setCopyNotice(null);
        }, 2000);
      } catch {
        setCopyNotice("コピーできませんでした");
        toast.error("コピーできませんでした");
      }
    },
    [toast]
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

  const persistDraftSync = useCallback(
    (sessionId: string | null, value: string) => {
      try {
        if (typeof window === "undefined") {
          return;
        }
        const key = draftKeyFor(sessionId);
        if (value) {
          localStorage.setItem(key, value);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // 同期保存の失敗は無視する
      }
    },
    []
  );

  const handleStartNewChat = useCallback(() => {
    if (isStreaming) {
      const ok = window.confirm(
        "AIが返信を作成中です。新規相談を始めると返信が止まります。続けますか？入力中の下書きは自動保存されます。"
      );
      if (!ok) {
        return;
      }
    }
    persistDraftSync(currentSessionId, input);
    setShowHistoryView(false);
    setInput("");
    loadedDraftForRef.current = draftKeyFor(null);
    setFailedDraft(null);
    lastSentRef.current = null;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (chatFocus) {
      consumeFocus();
    }
    startNewChat();
  }, [
    isStreaming,
    persistDraftSync,
    currentSessionId,
    input,
    chatFocus,
    consumeFocus,
    startNewChat,
  ]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === currentSessionId) {
        setShowHistoryView(false);
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。別の相談に切り替えると返信が止まります。切り替えますか？入力中の下書きは自動保存されます。"
        );
        if (!ok) {
          return;
        }
      }
      persistDraftSync(currentSessionId, input);
      void selectSession(id);
      setShowHistoryView(false);
    },
    [currentSessionId, isStreaming, persistDraftSync, input, selectSession]
  );

  // 小説切替の破棄防止（未送信入力あり or 返信中は確認する）
  const handleNovelChange = useCallback(
    (id: string | null) => {
      if (id === selectedNovelId) {
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。対象の小説を切り替えると返信が止まります。切り替えますか？入力中の下書きは自動保存されます。"
        );
        if (!ok) {
          return;
        }
      } else if (input.trim()) {
        const ok = window.confirm(
          "入力中の下書きがあります。切り替えても下書きは自動保存され、戻すと復元されます。切り替えますか？"
        );
        if (!ok) {
          return;
        }
      }
      persistDraftSync(currentSessionId, input);
      setSelectedNovelId(id);
    },
    [
      selectedNovelId,
      isStreaming,
      input,
      persistDraftSync,
      currentSessionId,
      setSelectedNovelId,
    ]
  );

  // モデル切替の破棄防止（返信中は確認する）
  const handleModelChange = useCallback(
    (id: string | null) => {
      if (id === selectedModelConfigId) {
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。モデルを切り替えると次の返信から反映されます。切り替えますか？"
        );
        if (!ok) {
          return;
        }
      }
      setSelectedModelConfigId(id);
    },
    [selectedModelConfigId, isStreaming, setSelectedModelConfigId]
  );

  const onSaveTitle = useCallback(
    async (id: string, newTitle: string) => {
      const ok = await updateSessionTitle(id, newTitle);
      if (ok) {
        toast.success("タイトルを変更しました");
      } else {
        toast.error("タイトルの変更に失敗しました");
      }
      return ok;
    },
    [updateSessionTitle, toast]
  );

  const onDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
        toast.success("相談履歴を削除しました");
      } catch {
        toast.error("削除に失敗しました");
      }
    },
    [deleteSession, toast]
  );

  const currentNovel = novels.find((n) => n.id === selectedNovelId) ?? null;

  return {
    abortStream,
    chatFocus,
    clearError,
    closeChat,
    consumeFocus,
    copiedId,
    copyNotice,
    currentNovelTitle: currentNovel ? currentNovel.title : null,
    currentSession,
    currentSessionId,
    deleteSession,
    dismissFailedDraft,
    drawerWidth,
    error,
    failedDraft,
    handleCopy,
    handleKeyDown,
    handleLayoutModeChange,
    handleMessagesScroll,
    handleModelChange,
    handleNovelChange,
    handleQuickPrompt,
    handleSelectSession,
    handleSend,
    handleStartNewChat,
    handleTextareaInput,
    handleWidthChange,
    input,
    isDialog,
    isOpen,
    isPinnedToBottom,
    isStreaming,
    lastPrompt,
    layoutMode,
    loadingMessages,
    messages,
    messagesContainerRef,
    novels,
    onDeleteSession,
    onSaveTitle,
    pinnedIds,
    togglePin,
    progress,
    restoreFailedDraft,
    retryLastMessage,
    scrollToBottom,
    selectedModelConfigId,
    selectedNovelId,
    sessions,
    setInput,
    setSelectedModelConfigId,
    setSelectedNovelId,
    setShowHistoryView,
    showHistoryView,
    showJumpButton,
    streamingContent,
    streamingParts,
    textareaRef,
  };
}
