import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toErrorMessage } from "@/lib/errors.js";
import { updateChatSession } from "@/lib/services/index.js";
import {
  type ChatMessage,
  extractTitle,
  hasToolPart,
  textOf,
} from "./chatStreamingTypes.js";
import {
  chatCacheKey,
  loadCachedMessages,
  useChatTransport,
} from "./chatTransport.js";
import { useChatActions } from "./useChatActions.js";
import { useChatProgress } from "./useChatProgress.js";

// 互換のための再エクスポート（既存の import パスを維持する）
export type {
  ChatMessage,
  ChatProgress,
  ChatProgressPhase,
  StreamingProgress,
} from "./chatStreamingTypes.js";
export { rowToUIMessage } from "./chatStreamingTypes.js";

/** チャットのストリーミング状態機械に必要なセッション層の入力 */
export interface UseChatStreamingInput {
  /** セッション一覧のリフレッシュ（クエリの invalidate をラップしたもの） */
  refreshSessions: () => Promise<void>;
  /** 選択中の小説ID（最新値を同期参照するための ref） */
  selectedNovelIdRef: RefObject<string | null>;
}

/**
 * チャットのメッセージ・ストリーミング状態機械を担うフック。
 * AI SDK（@ai-sdk/react の useChat + DefaultChatTransport）を使って
 * '/api/chat' への送信と UI Message Stream の受信を行う。
 *
 * 単一 source of truth: メッセージ一覧・ストリーミング状態・進捗・
 * セッション選択はすべてここで一元管理する。ChatContext はこのフックへ
 * 委譲するのみで派生値の再計算や重複 state を持たない。
 *
 * セッション一覧の取得自体は ChatContext 側の useQuery が行うため、
 * selectedNovelIdRef と refreshSessions を注入して連携する。
 */
const ACTIVE_SESSION_STORAGE_KEY = "novel-creator:active-session";

export function useChatStreaming({
  selectedNovelIdRef,
  refreshSessions,
}: UseChatStreamingInput) {
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") {
        return null;
      }
      return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  );
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<
    string | null
  >(() => localStorage.getItem("novel-creator:chat-model") || null);
  const selectedModelConfigIdRef = useRef<string | null>(selectedModelConfigId);
  selectedModelConfigIdRef.current = selectedModelConfigId;

  const [error, setError] = useState<string | null>(null);

  // sessionId を同期参照するための ref。
  // createSession 直後など state 反映前でも transport から最新値を読めるようにする。
  const sessionIdRef = useRef<string | null>(currentSessionId);

  // selectedNovelId は外部（ChatContext）から ref で注入されるため、
  // 最新値を毎レンダーで live な ref にコピーして stale closure を避ける。
  const selectedNovelIdLiveRef = useRef<string | null>(
    selectedNovelIdRef.current
  );
  selectedNovelIdLiveRef.current = selectedNovelIdRef.current;

  // 新規セッションの初回応答後にタイトルを応答から設定するためのフラグ
  const autoCreatedSessionRef = useRef<string | null>(null);

  // state の currentSessionId を同期更新するラッパー
  const setCurrentSessionId = useCallback((id: string | null) => {
    currentSessionIdRef.current = id;
    sessionIdRef.current = id;
    setCurrentSessionIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      }
    }
  }, []);

  const handleSetSelectedModelConfigId = useCallback((id: string | null) => {
    setSelectedModelConfigId(id);
    selectedModelConfigIdRef.current = id;
    if (id) {
      localStorage.setItem("novel-creator:chat-model", id);
    } else {
      localStorage.removeItem("novel-creator:chat-model");
    }
  }, []);

  // 進捗状態（バックエンドの data-progress パーツ由来）は useChatProgress に委譲する
  const {
    progress,
    setProgress,
    resetProgress,
    ensureProgressStarted,
    handleProgressData,
  } = useChatProgress();

  // 送信時に毎回 sessionId / novelId / modelConfigId を ref 経由で最新値を埋め込む
  const transport = useChatTransport({
    sessionIdRef,
    selectedNovelIdLiveRef,
    selectedModelConfigIdRef,
  });

  const {
    messages: uiMessages,
    setMessages: setUiMessages,
    sendMessage: chatSendMessage,
    stop,
    status,
    error: chatError,
  } = useChat({
    id: "main-chat",
    transport,
    onData: handleProgressData,
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "チャットエラーが発生しました"
      );
    },
    onFinish: ({ isAbort, isError, message }) => {
      if (isAbort || isError) {
        return;
      }
      // 新規セッションの初回応答完了後: 応答テキストからタイトル案を PUT + 一覧再取得
      if (
        autoCreatedSessionRef.current &&
        autoCreatedSessionRef.current === currentSessionIdRef.current
      ) {
        autoCreatedSessionRef.current = null;
        const title = extractTitle(message);
        if (title && currentSessionIdRef.current) {
          // セッションタイトルの永続化失敗はユーザーに見える状態（セッション一覧の
          // タイトル）へ影響するため、既存のエラー経路（error state）で通知する。
          void updateChatSession(currentSessionIdRef.current, {
            title,
          }).catch((err: unknown) => {
            setError(toErrorMessage(err));
          });
        }
      }
      void refreshSessions();
    },
  });

  // マウント時に sessionStorage にキャッシュされたメッセージがあれば即座に初期表示
  const cacheLoadedRef = useRef(false);
  useEffect(() => {
    if (cacheLoadedRef.current || !currentSessionId) {
      return;
    }
    cacheLoadedRef.current = true;
    const cached = loadCachedMessages(currentSessionId);
    if (cached) {
      setUiMessages(cached);
    }
  }, [currentSessionId, setUiMessages]);

  // メッセージ更新時にローカルキャッシュへ即時同期
  useEffect(() => {
    if (!currentSessionId || typeof window === "undefined") {
      return;
    }
    if (uiMessages.length > 0) {
      try {
        sessionStorage.setItem(
          chatCacheKey(currentSessionId),
          JSON.stringify(uiMessages)
        );
      } catch (err: unknown) {
        // メッセージのローカル永続化（リロード後の復元用）の失敗は、ストリーム終了後に
        // 表示履歴が残らない状態へ直結するため、既存のエラー経路で通知する。
        setError(toErrorMessage(err));
      }
    }
  }, [currentSessionId, uiMessages]);

  // useChat の error 状態を既存の error 文字列 state に同期する
  useEffect(() => {
    if (chatError) {
      setError(chatError.message);
    }
  }, [chatError]);

  // 公開 API 用の派生値
  const isStreaming = status === "submitted" || status === "streaming";

  // isStreaming を同期参照するための ref。
  // selectSession など UI 操作系のコールバックが依存に isStreaming を含めずに済み、
  // コールバックの同一性（= 低頻度 context value の安定性）が保たれる。
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // isStreaming の開始/終了に合わせて進捗状態を初期化/クリアする。
  // 開始時（status が submitted になった時点）に開始時刻を確定して進捗を既定値で立て、
  // 終了時には progress を null に戻す。data-progress パーツは常にこの既定値より後の値で上書きする。
  useEffect(() => {
    if (isStreaming) {
      const startedAt = ensureProgressStarted();
      setProgress((prev) =>
        prev
          ? prev
          : {
              phase: "start",
              step: 0,
              maxSteps: 8,
              startedAt,
            }
      );
    } else {
      resetProgress();
    }
  }, [isStreaming, ensureProgressStarted, setProgress, resetProgress]);

  // 画面に表示する確定済みメッセージ。
  // ストリーミング中は最後のアシスタント応答（進行中）を丸ごと除外し、
  // streamingContent / streamingParts 側で表示する（二重表示防止）。
  // 多段ツール実行で text パーツがまだ流れていない間も、この除外により同じツールカードが
  // メッセージ一覧 と ストリーミングバブル に二重表示されない。
  const messages: ChatMessage[] = useMemo(() => {
    return uiMessages
      .filter((m, index) => {
        // ストリーミング中: 最後のアシスタント応答（進行中のチャンク）を除外する
        if (
          isStreaming &&
          index === uiMessages.length - 1 &&
          m.role === "assistant"
        ) {
          return false;
        }
        // 旧来の除外条件（streaming text パーツを持つメッセージ）。残骸があれば引き続き除外する。
        const hasStreamingText = m.parts.some(
          (p) => p.type === "text" && p.state === "streaming"
        );
        return !hasStreamingText;
      })
      .map((m) => ({
        id: m.id,
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: textOf(m),
        createdAt: Date.now(),
        parts: m.parts,
      }))
      .filter((m) => m.content !== "" || hasToolPart(m.parts));
  }, [uiMessages, isStreaming]);

  // ストリーミング中のリアルタイム表示用テキスト
  const streamingContent = useMemo(() => {
    if (!isStreaming) {
      return "";
    }
    const last = uiMessages[uiMessages.length - 1];
    if (!last || last.role !== "assistant") {
      return "";
    }
    return textOf(last);
  }, [uiMessages, isStreaming]);

  // ストリーミング中のアシスタントメッセージの生 parts。
  // ツール呼び出しパーツを送信完了前でも随時表示するために公開する。
  const streamingParts = useMemo<UIMessage["parts"] | null>(() => {
    if (!isStreaming) {
      return null;
    }
    const last = uiMessages[uiMessages.length - 1];
    if (!last || last.role !== "assistant") {
      return null;
    }
    return last.parts;
  }, [uiMessages, isStreaming]);

  // セッション操作・送信・中断・再試行は useChatActions に委譲する（単一 source の一部）
  const {
    createSession,
    deleteSession,
    sendMessage,
    abortStream,
    abortStreamDiscard,
    clearMessages,
    retryLastMessage,
    clearError,
    lastPromptRef,
  } = useChatActions({
    autoCreatedSessionRef,
    chatSendMessage,
    currentSessionIdRef,
    isStreaming,
    messages,
    refreshSessions,
    selectedNovelIdLiveRef,
    setCurrentSessionId,
    setError,
    setUiMessages,
    stop,
  });

  // 戻り値は ChatProvider から2つの context value に分配されるため
  // メモ化してフィールド単位の同一性を保証する
  return useMemo(
    () => ({
      currentSessionId,
      setCurrentSessionId,
      currentSessionIdRef,
      selectedModelConfigId,
      setSelectedModelConfigId: handleSetSelectedModelConfigId,
      messages,
      setMessages: setUiMessages,
      isStreaming,
      isStreamingRef,
      streamingContent,
      streamingParts,
      progress,
      error,
      setError,
      clearError,
      lastPrompt: lastPromptRef.current,
      retryLastMessage,
      createSession,
      deleteSession,
      sendMessage,
      abortStream,
      abortStreamDiscard,
      clearMessages,
    }),
    [
      currentSessionId,
      setCurrentSessionId,
      selectedModelConfigId,
      handleSetSelectedModelConfigId,
      messages,
      setUiMessages,
      isStreaming,
      streamingContent,
      streamingParts,
      progress,
      error,
      clearError,
      lastPromptRef.current,
      retryLastMessage,
      createSession,
      deleteSession,
      sendMessage,
      abortStream,
      abortStreamDiscard,
      clearMessages,
    ]
  );
}
