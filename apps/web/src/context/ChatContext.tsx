import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { fetchChatSession, fetchChatSessions, updateChatSession } from '@/lib/services/index.js';
import { chatKeys } from '@/lib/queryKeys.js';
import { rowToUIMessage, useChatStreaming, type ChatMessage } from '@/hooks/useChatStreaming.js';
import type { ChatSession } from '@/lib/types.js';

export type { ChatMessage } from '@/hooks/useChatStreaming.js';

export interface QuickPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: string;
}

/**
 * エディタからチャットへ渡す相談フォーカス情報。
 * 「この設定/人物について相談」ボタンから openChat に渡され、
 * ChatDrawer が入力欄へのプリフィルに消費する。
 */
export interface ChatFocusContext {
  entityType: 'character' | 'setting';
  /** 例: 設定「大まかなあらすじ」/ 人物「主人公」 */
  title: string;
  /** category / 概要テキスト（長すぎる場合は先頭数百文字に切り詰め済みであることが望ましい） */
  summary?: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'character-ideas',
    title: '登場人物のアイデア出し',
    description: '世界観に合う魅力的な登場人物案を複数提案',
    prompt:
      'この小説の世界観や設定に合う、魅力的で個性的な新しい登場人物のアイデアを3名ほど提案してください。それぞれの【名前】【役割/身分】【外見・特徴】【性格】【能力/特技】【物語上の動機/目的】【既存キャラとの関係性案】を構造化してまとめてください。',
    icon: '🎭',
  },
  {
    id: 'setting-expand',
    title: '世界観・設定の深掘り',
    description: '魔法・文化・地理・組織などの設定を具体化',
    prompt:
      'この小説の世界観設定をより深みのあるものにするためのアイデアを提案してください。特に、魔法/技術体系、国家・組織の対立構造、地理的特徴、文化・風習などの観点から、物語の面白さに直結する要素を具体的に掘り下げてください。',
    icon: '🌍',
  },
  {
    id: 'plot-ideas',
    title: 'プロット・展開の壁打ち',
    description: '中盤の山場やどんでん返しの展開案をブレスト',
    prompt:
      'この小説のストーリー展開について相談です。読者を惹きつける「中盤の転換点（ツイスト）」や「クライマックスへの盛り上がり」につながる展開のアイデアをいくつか提示してください。伏線やキャラクターの葛藤も絡めた案をお願いします。',
    icon: '📖',
  },
  {
    id: 'consistency-check',
    title: '設定・人物の矛盾チェック',
    description: '登録済み設定や人物間の整合性をレビュー',
    prompt:
      '現在登録されている小説情報、世界観設定、登場人物情報を確認し、論理的な矛盾や設定の甘さ、あるいは「もっとこうすると面白くなる・整合性が高まる」改善点があれば指摘・提案してください。',
    icon: '🔍',
  },
  {
    id: 'app-usage-guide',
    title: 'アプリの使い方を教えて',
    description: '主要機能の場所と簡単な手順を案内',
    prompt:
      'アプリの使い方を教えてください。主要な機能と、その場所（画面やタブ）と簡単な手順を、初心者にも分かるようにまとめてください。',
    icon: '💡',
  },
];

export interface ChatContextValue {
  isOpen: boolean;
  openChat: (targetNovelId?: string | null, focus?: ChatFocusContext) => void;
  closeChat: () => void;
  toggleChat: () => void;
  /** openChat に渡された未消費の相談フォーカス（プリフィル用） */
  chatFocus: ChatFocusContext | null;
  /** chatFocus を消費済みにする（二重プリフィル防止） */
  consumeFocus: () => void;
  selectedNovelId: string | null;
  setSelectedNovelId: (id: string | null) => void;

  // セッション関連
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  selectedModelConfigId: string | null;
  setSelectedModelConfigId: (id: string | null) => void;
  loadingSessions: boolean;
  loadingMessages: boolean;

  startNewChat: () => void;
  createSession: (novelId?: string | null, initialTitle?: string) => Promise<ChatSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;
  refreshSessions: () => Promise<void>;

  // メッセージ・ストリーミング関連
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  /** ストリーミング中のアシスタントメッセージの生 parts（ツール呼び出しの随時表示用） */
  streamingParts: UIMessage['parts'] | null;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNovelId, setSelectedNovelIdState] = useState<string | null>(null);
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
  const sessions = sessionsQuery.data ?? [];
  const loadingSessions = sessionsQuery.isLoading;

  // セッション一覧のリフレッシュ
  const refreshSessions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: chatKeys.all });
  }, [queryClient]);

  // メッセージ・ストリーミング状態機械（セッション自動作成・削除を含む）
  const {
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    selectedModelConfigId,
    setSelectedModelConfigId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    streamingContent,
    setStreamingContent,
    streamingParts,
    error,
    setError,
    abortControllerRef,
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
            }),
          );
          setMessages(seeded);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'メッセージの取得に失敗しました';
        setError(msg);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [setError, setMessages],
  );

  // 新しい相談を開始（画面をクリアして新規作成待ち状態にする）
  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingContent('');
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
  }, [
    abortControllerRef,
    setCurrentSessionId,
    setError,
    setIsStreaming,
    setMessages,
    setStreamingContent,
  ]);

  // セッション切り替え
  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === currentSessionIdRef.current) return;
      if (isStreaming) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
        setStreamingContent('');
      }
      setCurrentSessionId(sessionId);
      await loadSessionMessages(sessionId);
    },
    [
      abortControllerRef,
      currentSessionIdRef,
      isStreaming,
      loadSessionMessages,
      setCurrentSessionId,
      setIsStreaming,
      setStreamingContent,
    ],
  );

  // セッションタイトル更新（成否を呼び出し元が判定できるよう結果を返す）
  const updateSessionTitle = useCallback(
    async (sessionId: string, newTitle: string): Promise<boolean> => {
      const trimmed = newTitle.trim();
      if (!trimmed) return false;
      try {
        await updateChatSession(sessionId, { title: trimmed });
        await queryClient.invalidateQueries({ queryKey: chatKeys.all });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'タイトルの更新に失敗しました';
        setError(msg);
        return false;
      }
    },
    [queryClient, setError],
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
    [setCurrentSessionId, setError, setMessages],
  );

  const openChat = useCallback(
    (targetNovelId?: string | null, focus?: ChatFocusContext) => {
      if (targetNovelId !== undefined && targetNovelId !== selectedNovelIdRef.current) {
        setSelectedNovelId(targetNovelId);
      }
      if (focus !== undefined) {
        setChatFocus(focus);
      }
      setIsOpen(true);
    },
    [setSelectedNovelId],
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

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;

  return (
    <ChatContext.Provider
      value={{
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

        messages,
        isStreaming,
        streamingContent,
        streamingParts,
        error,
        sendMessage,
        abortStream,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
