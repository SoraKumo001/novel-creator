import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ChatMessage,
  rowToUIMessage,
  type StreamingProgress,
  useChatStreaming,
} from "@/hooks/useChatStreaming.js";
import { chatKeys } from "@/lib/queryKeys.js";
import {
  fetchChatSession,
  fetchChatSessions,
  updateChatSession,
} from "@/lib/services/index.js";
import type { ChatSession } from "@/lib/types.js";

export type { ChatMessage } from "@/hooks/useChatStreaming.js";

export interface QuickPrompt {
  description: string;
  icon: string;
  id: string;
  prompt: string;
  title: string;
}

/**
 * エディタからチャットへ渡す相談フォーカス情報。
 * 「この設定/人物について相談」ボタンから openChat に渡され、
 * ChatDrawer が入力欄へのプリフィルに消費する。
 */
export interface ChatFocusContext {
  entityType:
    | "character"
    | "setting"
    | "foreshadowing"
    | "section"
    | "selection"
    | "markdown_section";
  /** 選択中のテキスト（ある場合） */
  selectedText?: string;
  /** category / 概要 / セクション本文など */
  summary?: string;
  /** 例: 設定「大まかなあらすじ」/ 人物「主人公」/ 第1話「プロローグ」/ 選択テキスト */
  title: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "character-ideas",
    title: "登場人物のアイデア出し",
    description: "世界観に合う魅力的な登場人物案を複数提案",
    prompt:
      "この小説の世界観や設定に合う、魅力的で個性的な新しい登場人物のアイデアを3名ほど提案してください。それぞれの【名前】【役割/身分】【外見・特徴】【性格】【能力/特技】【物語上の動機/目的】【既存キャラとの関係性案】を構造化してまとめてください。",
    icon: "🎭",
  },
  {
    id: "setting-expand",
    title: "世界観・設定の深掘り",
    description: "魔法・文化・地理・組織などの設定を具体化",
    prompt:
      "この小説の世界観設定をより深みのあるものにするためのアイデアを提案してください。特に、魔法/技術体系、国家・組織の対立構造、地理的特徴、文化・風習などの観点から、物語の面白さに直結する要素を具体的に掘り下げてください。",
    icon: "🌍",
  },
  {
    id: "plot-ideas",
    title: "プロット・展開の壁打ち",
    description: "中盤の山場やどんでん返しの展開案をブレスト",
    prompt:
      "この小説のストーリー展開について相談です。読者を惹きつける「中盤の転換点（ツイスト）」や「クライマックスへの盛り上がり」につながる展開のアイデアをいくつか提示してください。伏線やキャラクターの葛藤も絡めた案をお願いします。",
    icon: "📖",
  },
  {
    id: "consistency-check",
    title: "設定・人物の矛盾チェック",
    description: "登録済み設定や人物間の整合性をレビュー",
    prompt:
      "現在登録されている小説情報、世界観設定、登場人物情報を確認し、論理的な矛盾や設定の甘さ、あるいは「もっとこうすると面白くなる・整合性が高まる」改善点があれば指摘・提案してください。",
    icon: "🔍",
  },
  {
    id: "app-usage-guide",
    title: "アプリの使い方を教えて",
    description: "主要機能の場所と簡単な手順を案内",
    prompt:
      "アプリの使い方を教えてください。主要な機能と、その場所（画面やタブ）と簡単な手順を、初心者にも分かるようにまとめてください。",
    icon: "💡",
  },
];

/**
 * 低頻度 context: チャットの開閉・フォーカス・小説/セッション選択など操作系。
 * ストリーミング中（チャンク毎の更新）でも value の参照が変わらないため、
 * Nav / Layout / 各エディタなどの consumer はストリーミングの影響を受けない。
 */
export interface ChatUIContextValue {
  /** openChat に渡された未消費の相談フォーカス（プリフィル用） */
  chatFocus: ChatFocusContext | null;
  clearMessages: () => void;
  closeChat: () => void;
  /** chatFocus を消費済みにする（二重プリフィル防止） */
  consumeFocus: () => void;
  createSession: (
    novelId?: string | null,
    initialTitle?: string
  ) => Promise<ChatSession | null>;
  currentSession: ChatSession | null;
  currentSessionId: string | null;
  deleteSession: (sessionId: string) => Promise<void>;
  isOpen: boolean;
  loadingMessages: boolean;
  loadingSessions: boolean;
  openChat: (targetNovelId?: string | null, focus?: ChatFocusContext) => void;
  refreshSessions: () => Promise<void>;
  selectedModelConfigId: string | null;
  selectedNovelId: string | null;
  selectSession: (sessionId: string) => Promise<void>;

  // セッション関連
  sessions: ChatSession[];
  setSelectedModelConfigId: (id: string | null) => void;
  setSelectedNovelId: (id: string | null) => void;

  startNewChat: () => void;
  toggleChat: () => void;
  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;
}

/**
 * 高頻度 context: メッセージ一覧とストリーミング状態。
 * ストリーミング中はチャンク毎に value が新しくなるため、
 * ここを購読する consumer は ChatDrawer（転写領域）など表示に直接関係するものに限定する。
 */
export interface ChatStreamingContextValue {
  abortStream: () => void;
  clearError: () => void;
  error: string | null;
  isStreaming: boolean;
  lastPrompt: string | null;
  messages: ChatMessage[];
  /** バックエンド（data-progress パーツ）由来のリアルタイム進捗。isStreaming 中のみ非 null */
  progress: StreamingProgress | null;
  retryLastMessage: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  streamingContent: string;
  /** ストリーミング中のアシスタントメッセージの生 parts（ツール呼び出しの随時表示用） */
  streamingParts: UIMessage["parts"] | null;
}

export const ChatUIContext = createContext<ChatUIContextValue | null>(null);
export const ChatStreamingContext =
  createContext<ChatStreamingContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  // --- 低頻度: 開閉・フォーカス・小説選択 ---
  const [isOpen, setIsOpen] = useState(false);
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

  // --- 高頻度: メッセージ・ストリーミング状態機械（セッション自動作成・削除を含む） ---
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
    [setSelectedNovelId]
  );

  const consumeFocus = useCallback(() => {
    setChatFocus(null);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

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
