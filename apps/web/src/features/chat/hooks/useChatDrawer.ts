import type { KeyboardEvent, RefObject } from "react";
import { useChatStreamingState, useChatUI } from "@/context/ChatContext.js";
import {
  type ChatFocusContext,
  type QuickPrompt,
} from "@/context/chatUiTypes.js";
import { useNovels } from "@/hooks/useNovels.js";
import { useChatDrawerClipboard } from "./useChatDrawerClipboard.js";
import { useChatDrawerFocus } from "./useChatDrawerFocus.js";
import { useChatDrawerHistory } from "./useChatDrawerHistory.js";
import { useChatDrawerInput } from "./useChatDrawerInput.js";
import { useChatDrawerLayout } from "./useChatDrawerLayout.js";
import { useChatDrawerScroll } from "./useChatDrawerScroll.js";

export type DrawerWidth = "normal" | "wide" | "full";
export type ChatLayoutMode = "overlay" | "docked";

export interface ChatDrawerInputState {
  chatFocus: ChatFocusContext | null;
  consumeFocus: () => void;
  dismissFailedDraft: () => void;
  failedDraft: string | null;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleQuickPrompt: (qp: QuickPrompt) => Promise<void>;
  handleSend: () => Promise<void>;
  handleTextareaInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  input: string;
  restoreFailedDraft: () => void;
  setInput: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export interface ChatDrawerHistoryState {
  currentSession: { id: string; title: string } | null;
  currentSessionId: string | null;
  deleteSession: (sessionId: string) => Promise<void>;
  handleModelChange: (id: string | null) => void;
  handleNovelChange: (id: string | null) => void;
  handleSelectSession: (id: string) => void;
  handleStartNewChat: () => void;
  onDeleteSession: (id: string) => Promise<void>;
  onSaveTitle: (id: string, newTitle: string) => Promise<boolean>;
  pinnedIds: Set<string>;
  selectedModelConfigId: string | null;
  selectedNovelId: string | null;
  sessions: ReturnType<typeof useChatUI>["sessions"];
  setSelectedModelConfigId: (id: string | null) => void;
  setSelectedNovelId: (id: string | null) => void;
  setShowHistoryView: (v: boolean | ((prev: boolean) => boolean)) => void;
  showHistoryView: boolean;
  togglePin: (id: string) => void;
}

export interface ChatDrawerShellState {
  abortStream: () => void;
  clearError: () => void;
  closeChat: () => void;
  copiedId: string | null;
  copyNotice: string | null;
  currentNovelTitle: string | null;
  drawerWidth: DrawerWidth;
  error: string | null;
  handleCopy: (content: string, id: string) => Promise<void>;
  handleLayoutModeChange: (mode: ChatLayoutMode) => void;
  handleMessagesScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleWidthChange: (width: DrawerWidth) => void;
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
  progress: ReturnType<typeof useChatStreamingState>["progress"];
  retryLastMessage: () => Promise<void>;
  scrollToBottom: () => void;
  showJumpButton: boolean;
  streamingContent: string;
  streamingParts: ReturnType<typeof useChatStreamingState>["streamingParts"];
}

interface UseChatDrawerResult {
  drawer: ChatDrawerShellState;
  history: ChatDrawerHistoryState;
  input: ChatDrawerInputState;
}

/**
 * ChatDrawer の互換ファサード。
 * 振る舞い（入力・送信・スクロール追従・幅/配置・履歴操作）は責務ごとの
 * hooks（./useChatDrawer*.ts）に分離し、ここでは合成のみ行う。
 * 戻り値は drawer（表示枠・ストリーミング・操作系共有）/ input（入力・送信・
 * 下書き）/ history（セッション切替・履歴操作）の3スライスで返却する。
 * 各フィールドの実体・発火条件・ガード・debounce条件は変更しない。
 * 描画は ChatDrawer 側に残す。
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

  // ドロワー表示設定（幅・配置・ダイアログ判定）
  const layout = useChatDrawerLayout();

  // 入力・送信・下書き
  const input = useChatDrawerInput({
    chatFocus,
    consumeFocus,
    currentSessionId,
    error,
    isStreaming,
    sendMessage,
  });

  // 履歴・セッション切替（入力 hook の下書き退避・初期化と連携する）
  const history = useChatDrawerHistory({
    chatFocus,
    consumeFocus,
    currentSessionId,
    deleteSession,
    inputValue: input.input,
    isStreaming,
    persistDraftSync: input.persistDraftSync,
    resetInputForNewChat: input.resetInputForNewChat,
    selectedModelConfigId,
    selectedNovelId,
    selectSession,
    setSelectedModelConfigId,
    setSelectedNovelId,
    startNewChat,
    updateSessionTitle,
  });

  // スクロール追従
  const scroll = useChatDrawerScroll({
    isStreaming,
    isOpen,
    messageCount: messages.length,
    showHistoryView: history.showHistoryView,
    streamingContent,
    streamingParts,
    textareaRef: input.textareaRef,
  });

  // フォーカス管理（副作用のみ）
  useChatDrawerFocus({
    chatFocus,
    closeChat,
    isDialog: layout.isDialog,
    isOpen,
    textareaRef: input.textareaRef,
  });

  // メッセージコピー
  const clipboard = useChatDrawerClipboard();

  const currentNovel = novels.find((n) => n.id === selectedNovelId) ?? null;

  return {
    drawer: {
      abortStream,
      clearError,
      closeChat,
      copiedId: clipboard.copiedId,
      copyNotice: clipboard.copyNotice,
      currentNovelTitle: currentNovel ? currentNovel.title : null,
      drawerWidth: layout.drawerWidth,
      error,
      handleCopy: clipboard.handleCopy,
      handleLayoutModeChange: layout.handleLayoutModeChange,
      handleMessagesScroll: scroll.handleMessagesScroll,
      handleWidthChange: layout.handleWidthChange,
      isDialog: layout.isDialog,
      isOpen,
      isPinnedToBottom: scroll.isPinnedToBottom,
      isStreaming,
      lastPrompt,
      layoutMode: layout.layoutMode,
      loadingMessages,
      messages,
      messagesContainerRef: scroll.messagesContainerRef,
      novels,
      progress,
      retryLastMessage,
      scrollToBottom: scroll.scrollToBottom,
      showJumpButton: scroll.showJumpButton,
      streamingContent,
      streamingParts,
    },
    history: {
      currentSession,
      currentSessionId,
      deleteSession,
      handleModelChange: history.handleModelChange,
      handleNovelChange: history.handleNovelChange,
      handleSelectSession: history.handleSelectSession,
      handleStartNewChat: history.handleStartNewChat,
      onDeleteSession: history.onDeleteSession,
      onSaveTitle: history.onSaveTitle,
      pinnedIds: history.pinnedIds,
      selectedModelConfigId,
      selectedNovelId,
      sessions,
      setSelectedModelConfigId,
      setSelectedNovelId,
      setShowHistoryView: history.setShowHistoryView,
      showHistoryView: history.showHistoryView,
      togglePin: history.togglePin,
    },
    input: {
      chatFocus,
      consumeFocus,
      dismissFailedDraft: input.dismissFailedDraft,
      failedDraft: input.failedDraft,
      handleKeyDown: input.handleKeyDown,
      handleQuickPrompt: input.handleQuickPrompt,
      handleSend: input.handleSend,
      handleTextareaInput: input.handleTextareaInput,
      input: input.input,
      restoreFailedDraft: input.restoreFailedDraft,
      setInput: input.setInput,
      textareaRef: input.textareaRef,
    },
  };
}
