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
import {
  loadActiveSessionId,
  loadCachedMessages,
  loadChatModelId,
  saveActiveSessionId,
  saveCachedMessages,
  saveChatModelId,
} from "@/lib/chat-storage.js";
import { toErrorMessage } from "@/lib/errors.js";
import { updateChatSession } from "@/lib/services/index.js";
import {
  type ChatMessage,
  extractTitle,
  hasToolPart,
  messageCreatedAt,
  textOf,
} from "./chatStreamingTypes.js";
import { useChatTransport } from "./chatTransport.js";
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
 *
 * 永続化の責務分担:
 * - セッション復元（アクティブセッションID・モデル選択）は `@/lib/chat-storage`
 *   の load/save ヘルパーに集約する。
 * - リトライ（最終プロンプト）・キャッシュ（セッションごとのメッセージ）は
 *   それぞれ useChatActions / 下記のキャッシュ同期 effect が担当し、
 *   実体は同じく `@/lib/chat-storage` に集約されている。
 */

export function useChatStreaming({
  selectedNovelIdRef,
  refreshSessions,
}: UseChatStreamingInput) {
  // セッション復元: リロード後に保存されていたアクティブセッションを初期値にする
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") {
        return null;
      }
      return loadActiveSessionId();
    }
  );
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<
    string | null
  >(loadChatModelId);
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

  // ユーザーが手動でタイトルを編集したセッションIDの集合。
  // onFinish の自動タイトル付与で上書きしないためのガードに使う。
  const titleEditedRef = useRef<Set<string>>(new Set());

  // セッションタイトルが手動編集されたことを記録する。
  // ChatContext の updateSessionTitle から呼び出される。
  const markTitleEdited = useCallback((sessionId: string) => {
    titleEditedRef.current.add(sessionId);
    if (autoCreatedSessionRef.current === sessionId) {
      autoCreatedSessionRef.current = null;
    }
  }, []);

  // 送信/セッション選択状態: state と ref を同期更新し、復元用保存も更新する
  const setCurrentSessionId = useCallback((id: string | null) => {
    currentSessionIdRef.current = id;
    sessionIdRef.current = id;
    setCurrentSessionIdState(id);
    saveActiveSessionId(id);
  }, []);

  // モデル選択状態: state と ref を同期更新し、復元用保存も更新する
  const handleSetSelectedModelConfigId = useCallback((id: string | null) => {
    setSelectedModelConfigId(id);
    selectedModelConfigIdRef.current = id;
    saveChatModelId(id);
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
    regenerate: chatRegenerate,
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
      // 新規セッションの初回応答完了後: 応答テキストからタイトル案を PUT + 一覧再取得。
      // 自動付与はセッション作成直後の初回のみ行い、ユーザーが手動編集済みの
      // セッションは上書きしない（仮題→応答先頭30字の無条件PUT競合を避ける）。
      if (
        autoCreatedSessionRef.current &&
        autoCreatedSessionRef.current === currentSessionIdRef.current
      ) {
        const targetSessionId = autoCreatedSessionRef.current;
        autoCreatedSessionRef.current = null;
        if (!titleEditedRef.current.has(targetSessionId)) {
          const title = extractTitle(message);
          if (title) {
            // セッションタイトルの永続化失敗はユーザーに見える状態（セッション一覧の
            // タイトル）へ影響するため、既存のエラー経路（error state）で通知する。
            void updateChatSession(targetSessionId, {
              title,
            }).catch((err: unknown) => {
              setError(toErrorMessage(err));
            });
          }
        }
      }
      void refreshSessions();
    },
  });

  // キャッシュ責務: マウント時に sessionStorage の楽観表示を復元する。
  // DB の正式な履歴は ChatContext の loadSessionMessages が sessionId 一致確認後に
  // 上書き確定するため、キャッシュ→DB の順序を守る（挙動は変更しない）。
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

  // キャッシュ責務: メッセージ更新時にローカルキャッシュへ即時同期する
  // （直近のみに軽量化）。保存失敗（QuotaExceededError 等）は握り潰さず
  // error state へ反映し、リトライ表示でユーザーに通知する。
  // ストリーミング自体は継続する（送信結果には影響しない）。
  useEffect(() => {
    if (!currentSessionId || typeof window === "undefined") {
      return;
    }
    if (uiMessages.length > 0) {
      try {
        saveCachedMessages(currentSessionId, uiMessages);
      } catch (error_) {
        setError(
          error_ instanceof Error
            ? error_.message
            : "メッセージキャッシュの保存に失敗しました"
        );
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

  // ストリーミング中のアシスタントメッセージID。
  // index===length-1 判定ではなくID一致で除外するため、末尾以外の位置に
  // 進行中メッセージがあっても二重表示・消失しない。
  const streamingAssistantId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }
    for (let index = uiMessages.length - 1; index >= 0; index -= 1) {
      const candidate = uiMessages[index];
      if (candidate && candidate.role === "assistant") {
        return candidate.id;
      }
    }
    return null;
  }, [uiMessages, isStreaming]);

  // 画面に表示する確定済みメッセージ。
  // ストリーミング中は進行中のアシスタント応答をID一致で除外し、
  // streamingContent / streamingParts 側で表示する（二重表示防止）。
  // 多段ツール実行で text パーツがまだ流れていない間も、この除外により同じツールカードが
  // メッセージ一覧 と ストリーミングバブル に二重表示されない。
  const messages: ChatMessage[] = useMemo(() => {
    return uiMessages
      .filter((m) => {
        // ストリーミング中: 進行中のアシスタント応答（ID一致）を除外する
        if (streamingAssistantId && m.id === streamingAssistantId) {
          return false;
        }
        // 旧来の除外条件（streaming text パーツを持つメッセージ）。残骸があれば引き続き除外する。
        const hasStreamingText = m.parts.some(
          (p) => p.type === "text" && p.state === "streaming"
        );
        return !hasStreamingText;
      })
      .map((m, index) => ({
        id: m.id,
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: textOf(m),
        // DB行由来の createdAt があれば保持し、無ければメッセージid順（index）を
        // フォールバックにする。Date.now() のダミー埋めは行わない。
        createdAt: messageCreatedAt(m, index),
        parts: m.parts,
      }))
      .filter((m) => m.content !== "" || hasToolPart(m.parts));
  }, [uiMessages, streamingAssistantId]);

  // ストリーミング中のリアルタイム表示用テキスト
  const streamingContent = useMemo(() => {
    if (!isStreaming || !streamingAssistantId) {
      return "";
    }
    const streaming = uiMessages.find((m) => m.id === streamingAssistantId);
    if (!streaming || streaming.role !== "assistant") {
      return "";
    }
    return textOf(streaming);
  }, [uiMessages, isStreaming, streamingAssistantId]);

  // ストリーミング中のアシスタントメッセージの生 parts。
  // ツール呼び出しパーツを送信完了前でも随時表示するために公開する。
  const streamingParts = useMemo<UIMessage["parts"] | null>(() => {
    if (!isStreaming || !streamingAssistantId) {
      return null;
    }
    const streaming = uiMessages.find((m) => m.id === streamingAssistantId);
    if (!streaming || streaming.role !== "assistant") {
      return null;
    }
    return streaming.parts;
  }, [uiMessages, isStreaming, streamingAssistantId]);

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
    chatRegenerate,
    chatSendMessage,
    currentSessionIdRef,
    isStreamingRef,
    messages,
    refreshSessions,
    selectedNovelIdLiveRef,
    setCurrentSessionId,
    setError,
    setUiMessages,
    stop,
    uiMessages,
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
      markTitleEdited,
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
      markTitleEdited,
    ]
  );
}
