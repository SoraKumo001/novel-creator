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

interface UseChatDrawerResult {
  abortStream: () => void;
  chatFocus: ChatFocusContext | null;
  clearError: () => void;
  closeChat: () => void;
  consumeFocus: () => void;
  copiedId: string | null;
  currentNovelTitle: string | null;
  currentSession: { id: string; title: string } | null;
  currentSessionId: string | null;
  deleteSession: (sessionId: string) => Promise<void>;
  drawerWidth: DrawerWidth;
  error: string | null;
  handleCopy: (content: string, id: string) => Promise<void>;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleLayoutModeChange: (mode: ChatLayoutMode) => void;
  handleMessagesScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleQuickPrompt: (qp: QuickPrompt) => Promise<void>;
  handleSelectSession: (id: string) => void;
  handleSend: () => Promise<void>;
  handleStartNewChat: () => void;
  handleTextareaInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleWidthChange: (width: DrawerWidth) => void;
  input: string;
  isOpen: boolean;
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
  retryLastMessage: () => Promise<void>;
  selectedModelConfigId: string | null;
  selectedNovelId: string | null;
  sessions: ReturnType<typeof useChatUI>["sessions"];
  setInput: (v: string) => void;
  setSelectedModelConfigId: (id: string | null) => void;
  setSelectedNovelId: (id: string | null) => void;
  setShowHistoryView: (v: boolean | ((prev: boolean) => boolean)) => void;
  showHistoryView: boolean;
  streamingContent: string;
  streamingParts: ReturnType<typeof useChatStreamingState>["streamingParts"];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  togglePin: (id: string) => void;
}

/**
 * ChatDrawer の振る舞い（入力・送信・スクロール追従・幅/配置・履歴操作）を集約する hook。
 * 描画は ChatDrawer 側に残し、ここでは状態遷移とイベントハンドラのみを提供する。
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
  const [showHistoryView, setShowHistoryView] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const handleWidthChange = useCallback((width: DrawerWidth) => {
    setDrawerWidth(width);
    localStorage.setItem("novel-creator:chat-width", width);
  }, []);

  const handleLayoutModeChange = useCallback((mode: ChatLayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem("novel-creator:chat-layout-mode", mode);
  }, []);

  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
      isUserScrolledUpRef.current = !isAtBottom;
    },
    []
  );

  // チャットオープン時や履歴切り替え時の初期スクロール & フォーカス
  useEffect(() => {
    if (isOpen && !showHistoryView) {
      isUserScrolledUpRef.current = false;
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
      textareaRef.current?.focus();
    }
  }, [isOpen, showHistoryView]);

  // 新規メッセージ追加時のスクロール
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

  // ストリーミング中の自動スクロール追従（requestAnimationFrameでスロットル & 非ブロッキング）
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

  // 送信ハンドラ
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) {
      return;
    }
    const text = input;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    const finalPrompt = buildChatPromptWithFocus(text, chatFocus);
    if (chatFocus) {
      consumeFocus();
    }
    await sendMessage(finalPrompt);
  }, [input, isStreaming, chatFocus, consumeFocus, sendMessage]);

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
      await sendMessage(qp.prompt);
    },
    [sendMessage]
  );

  const handleCopy = useCallback(
    async (content: string, id: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        toast.success("クリップボードにコピーしました");
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error("コピーに失敗しました");
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

  const handleStartNewChat = useCallback(() => {
    setShowHistoryView(false);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (chatFocus) {
      consumeFocus();
    }
    startNewChat();
  }, [chatFocus, consumeFocus, startNewChat]);

  const handleSelectSession = useCallback(
    (id: string) => {
      void selectSession(id);
      setShowHistoryView(false);
    },
    [selectSession]
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
    currentNovelTitle: currentNovel ? currentNovel.title : null,
    currentSession,
    currentSessionId,
    deleteSession,
    drawerWidth,
    error,
    handleCopy,
    handleKeyDown,
    handleLayoutModeChange,
    handleMessagesScroll,
    handleQuickPrompt,
    handleSelectSession,
    handleSend,
    handleStartNewChat,
    handleTextareaInput,
    handleWidthChange,
    input,
    isOpen,
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
    retryLastMessage,
    selectedModelConfigId,
    selectedNovelId,
    sessions,
    setInput,
    setSelectedModelConfigId,
    setSelectedNovelId,
    setShowHistoryView,
    showHistoryView,
    streamingContent,
    streamingParts,
    textareaRef,
  };
}
