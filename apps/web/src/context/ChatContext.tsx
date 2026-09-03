import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { rowToUIMessage, useChatStreaming } from "@/hooks/useChatStreaming.js";
import { chatKeys } from "@/lib/queryKeys.js";
import {
  fetchChatSession,
  fetchChatSessions,
  updateChatSession,
} from "@/lib/services/index.js";
import {
  type ChatFocusContext,
  ChatStreamingContext,
  type ChatStreamingContextValue,
  ChatUIContext,
  type ChatUIContextValue,
} from "./chatUiTypes.js";

// 互換のための再エクスポート（既存の import パスを維持する）
export type { ChatMessage } from "@/hooks/useChatStreaming.js";
export {
  type ChatFocusContext,
  ChatStreamingContext,
  type ChatStreamingContextValue,
  ChatUIContext,
  type ChatUIContextValue,
  QUICK_PROMPTS,
  type QuickPrompt,
} from "./chatUiTypes.js";

/**
 * ChatProvider: 低頻度（UI操作系）と高頻度（ストリーミング）の2 context を提供する。
 *
 * 単一 source of truth は useChatStreaming。メッセージ・ストリーミング状態・
 * 進捗の派生計算はすべてフック側に寄せ、ここではセッション一覧の取得と
 * セッション選択オーケストレーション（load/select/startNew）のみを行う。
 * 重複 state（messages / isStreaming 等）は持たない。
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  // --- 低頻度: 開閉・フォーカス・小説選択 ---
  const [isOpen, setIsOpenState] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem("novel-creator:chat-open") === "true";
  });

  const setIsOpen = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenState((prev) => {
        const next = typeof open === "function" ? open(prev) : open;
        if (typeof window !== "undefined") {
          localStorage.setItem("novel-creator:chat-open", String(next));
        }
        return next;
      });
    },
    []
  );

  const [selectedNovelId, setSelectedNovelIdState] = useState<string | null>(
    null
  );
  const [chatFocus, setChatFocus] = useState<ChatFocusContext | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const queryClient = useQueryClient();

  const selectedNovelIdRef = useRef<string | null>(selectedNovelId);
  selectedNovelIdRef.current = selectedNovelId;

  // セッション一覧の取得（小説ID変更時はクエリキー変更により自動再取得される）
  const sessionsQuery = useQuery({
    queryKey: chatKeys.sessions(selectedNovelId ?? undefined),
    queryFn: () => fetchChatSessions(selectedNovelId ?? undefined),
  });
  // `?? []` を素通しすると毎レンダー新配列になり低頻度 value のメモを無効化するためメモ化する
  const sessions = useMemo(
    () => sessionsQuery.data ?? [],
    [sessionsQuery.data]
  );
  const loadingSessions = sessionsQuery.isLoading;

  // セッション一覧のリフレッシュ
  const refreshSessions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: chatKeys.all });
  }, [queryClient]);

  // --- 高頻度: メッセージ・ストリーミング状態機械（単一 source へ委譲） ---
  const {
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    selectedModelConfigId,
    setSelectedModelConfigId,
    messages,
    setMessages,
    isStreaming,
    isStreamingRef,
    streamingContent,
    streamingParts,
    progress,
    error,
    setError,
    clearError,
    lastPrompt,
    retryLastMessage,
    abortStreamDiscard,
    createSession,
    deleteSession,
    sendMessage,
    abortStream,
    clearMessages,
  } = useChatStreaming({ selectedNovelIdRef, refreshSessions });

  // 特定セッションのメッセージ読み込み
  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      setLoadingMessages(true);
      setError(null);
      try {
        const detail = await fetchChatSession(sessionId);
        if (detail && Array.isArray(detail.messages)) {
          // DB の行を UI Message に変換して useChat に seed する
          const seeded: UIMessage[] = detail.messages.map((m) =>
            rowToUIMessage({
              id: m.id,
              role: m.role,
              content: m.content,
              parts: m.parts,
            })
          );
          setMessages(seeded);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "メッセージの取得に失敗しました";
        setError(msg);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [setError, setMessages]
  );

  // マウント時（リロード時）に保存されていたアクティブセッションのメッセージを最新化
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (initialLoadedRef.current) {
      return;
    }
    initialLoadedRef.current = true;
    if (currentSessionIdRef.current) {
      void loadSessionMessages(currentSessionIdRef.current);
    }
  }, [loadSessionMessages, currentSessionIdRef]);

  // 新しい相談を開始（画面をクリアして新規作成待ち状態にする）。
  // 進行中のストリーミングは部分応答を破棄して中止する（abortStream と異なり
  // 部分応答を done 化して確定しない。直後にメッセージを空にするため）。
  const startNewChat = useCallback(() => {
    void abortStreamDiscard();
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
  }, [abortStreamDiscard, setCurrentSessionId, setError, setMessages]);

  // セッション切り替え。
  // isStreaming は ref 経由で同期参照するため、ストリーミングの開始/終了でも
  // このコールバックの同一性は変わらない（低頻度 value を安定させる）。
  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === currentSessionIdRef.current) {
        return;
      }
      if (isStreamingRef.current) {
        // 切り替え先のメッセージで上書きするため、部分応答は確定せず破棄する
        void abortStreamDiscard();
      }
      setCurrentSessionId(sessionId);
      await loadSessionMessages(sessionId);
    },
    [
      abortStreamDiscard,
      currentSessionIdRef,
      isStreamingRef,
      loadSessionMessages,
      setCurrentSessionId,
    ]
  );

  // セッションタイトル更新（成否を呼び出し元が判定できるよう結果を返す）
  const updateSessionTitle = useCallback(
    async (sessionId: string, newTitle: string): Promise<boolean> => {
      const trimmed = newTitle.trim();
      if (!trimmed) {
        return false;
      }
      try {
        await updateChatSession(sessionId, { title: trimmed });
        await queryClient.invalidateQueries({ queryKey: chatKeys.all });
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "タイトルの更新に失敗しました";
        setError(msg);
        return false;
      }
    },
    [queryClient, setError]
  );

  // 小説変更ハンドラ
  // クエリキーに小説IDを含めているため、ID変更時は useQuery が自動で再取得する
  const setSelectedNovelId = useCallback(
    (id: string | null) => {
      setSelectedNovelIdState(id);
      setCurrentSessionId(null);
      setMessages([]);
      setError(null);
    },
    [setCurrentSessionId, setError, setMessages]
  );

  const openChat = useCallback(
    (targetNovelId?: string | null, focus?: ChatFocusContext) => {
      if (
        targetNovelId !== undefined &&
        targetNovelId !== selectedNovelIdRef.current
      ) {
        setSelectedNovelId(targetNovelId);
      }
      if (focus !== undefined) {
        setChatFocus(focus);
      }
      setIsOpen(true);
    },
    [setSelectedNovelId, setIsOpen]
  );

  const consumeFocus = useCallback(() => {
    setChatFocus(null);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, [setIsOpen]);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) ?? null,
    [sessions, currentSessionId]
  );

  // 低頻度 value: 依存は useState/useRef 由来の値と安定した useCallback のみ。
  // ストリーミング中にチャンクが流れても参照が変わらない。
  const uiValue = useMemo<ChatUIContextValue>(
    () => ({
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      chatFocus,
      consumeFocus,
      selectedNovelId,
      setSelectedNovelId,

      sessions,
      currentSessionId,
      currentSession,
      selectedModelConfigId,
      setSelectedModelConfigId,
      loadingSessions,
      loadingMessages,

      startNewChat,
      createSession,
      selectSession,
      deleteSession,
      updateSessionTitle,
      refreshSessions,
      clearMessages,
    }),
    [
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      chatFocus,
      consumeFocus,
      selectedNovelId,
      setSelectedNovelId,
      sessions,
      currentSessionId,
      currentSession,
      selectedModelConfigId,
      setSelectedModelConfigId,
      loadingSessions,
      loadingMessages,
      startNewChat,
      createSession,
      selectSession,
      deleteSession,
      updateSessionTitle,
      refreshSessions,
      clearMessages,
    ]
  );

  // 高頻度 value: ストリーミング中はチャンク毎に新しくなる
  const streamingValue = useMemo<ChatStreamingContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <ChatUIContext.Provider value={uiValue}>
      <ChatStreamingContext.Provider value={streamingValue}>
        {children}
      </ChatStreamingContext.Provider>
    </ChatUIContext.Provider>
  );
}

/** チャットの開閉・セッション選択などの操作系（低頻度）を取得する */
export function useChatUI() {
  const ctx = useContext(ChatUIContext);
  if (!ctx) {
    throw new Error("useChatUI must be used within a ChatProvider");
  }
  return ctx;
}

/** メッセージ一覧・ストリーミング状態（高頻度）を取得する */
export function useChatStreamingState() {
  const ctx = useContext(ChatStreamingContext);
  if (!ctx) {
    throw new Error("useChatStreamingState must be used within a ChatProvider");
  }
  return ctx;
}
