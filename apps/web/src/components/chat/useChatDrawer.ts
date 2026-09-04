import type { KeyboardEvent, RefObject } from "react";
import {
  type ChatFocusContext,
  type QuickPrompt,
  useChatStreamingState,
  useChatUI,
} from "@/context/ChatContext.js";
import { useNovels } from "@/hooks/useNovels.js";
import { useChatDrawerClipboard } from "./useChatDrawerClipboard.js";
import { useChatDrawerFocus } from "./useChatDrawerFocus.js";
import { useChatDrawerHistory } from "./useChatDrawerHistory.js";
import { useChatDrawerInput } from "./useChatDrawerInput.js";
import { useChatDrawerLayout } from "./useChatDrawerLayout.js";
import { useChatDrawerScroll } from "./useChatDrawerScroll.js";

export type DrawerWidth = "normal" | "wide" | "full";
export type ChatLayoutMode = "overlay" | "docked";

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
 * ChatDrawer の互換ファサード。
 * 振る舞い（入力・送信・スクロール追従・幅/配置・履歴操作）は責務ごとの
 * hooks（./useChatDrawer*.ts）に分離し、ここでは合成と戻り値形状の維持のみ行う。
 * 戻り値形状・発火条件・ガード・debounce条件は変更しない。
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
    abortStream,
    chatFocus,
    clearError,
    closeChat,
    consumeFocus,
    copiedId: clipboard.copiedId,
    copyNotice: clipboard.copyNotice,
    currentNovelTitle: currentNovel ? currentNovel.title : null,
    currentSession,
    currentSessionId,
    deleteSession,
    dismissFailedDraft: input.dismissFailedDraft,
    drawerWidth: layout.drawerWidth,
    error,
    failedDraft: input.failedDraft,
    handleCopy: clipboard.handleCopy,
    handleKeyDown: input.handleKeyDown,
    handleLayoutModeChange: layout.handleLayoutModeChange,
    handleMessagesScroll: scroll.handleMessagesScroll,
    handleModelChange: history.handleModelChange,
    handleNovelChange: history.handleNovelChange,
    handleQuickPrompt: input.handleQuickPrompt,
    handleSelectSession: history.handleSelectSession,
    handleSend: input.handleSend,
    handleStartNewChat: history.handleStartNewChat,
    handleTextareaInput: input.handleTextareaInput,
    handleWidthChange: layout.handleWidthChange,
    input: input.input,
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
    onDeleteSession: history.onDeleteSession,
    onSaveTitle: history.onSaveTitle,
    pinnedIds: history.pinnedIds,
    togglePin: history.togglePin,
    progress,
    restoreFailedDraft: input.restoreFailedDraft,
    retryLastMessage,
    scrollToBottom: scroll.scrollToBottom,
    selectedModelConfigId,
    selectedNovelId,
    sessions,
    setInput: input.setInput,
    setSelectedModelConfigId,
    setSelectedNovelId,
    setShowHistoryView: history.setShowHistoryView,
    showHistoryView: history.showHistoryView,
    showJumpButton: scroll.showJumpButton,
    streamingContent,
    streamingParts,
    textareaRef: input.textareaRef,
  };
}
