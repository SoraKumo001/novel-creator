import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createChatSession,
  deleteChatSession,
  fetchChatSession,
  fetchChatSessions,
  updateChatSession,
} from '@/lib/services/index.js';
import { streamChat } from '@/lib/chatApi.js';
import type { ChatSession } from '@/lib/types.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface QuickPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: string;
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
];

export interface ChatContextValue {
  isOpen: boolean;
  openChat: (targetNovelId?: string | null) => void;
  closeChat: () => void;
  toggleChat: () => void;
  selectedNovelId: string | null;
  setSelectedNovelId: (id: string | null) => void;

  // セッション関連
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  loadingSessions: boolean;
  loadingMessages: boolean;
  startNewChat: () => void;
  createSession: (novelId?: string | null, initialTitle?: string) => Promise<ChatSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<void>;
  refreshSessions: () => Promise<void>;

  // メッセージ・ストリーミング関連
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNovelId, setSelectedNovelIdState] = useState<string | null>(null);

  // セッション状態
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // メッセージ・対話状態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedNovelIdRef = useRef<string | null>(selectedNovelId);
  selectedNovelIdRef.current = selectedNovelId;
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  // セッション一覧の取得
  const fetchSessions = useCallback(async (novelId: string | null) => {
    setLoadingSessions(true);
    try {
      const data = await fetchChatSessions(novelId || undefined);
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      return list;
    } catch {
      setSessions([]);
      return [];
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // 特定セッションのメッセージ読み込み
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const detail = await fetchChatSession(sessionId);
      if (detail && Array.isArray(detail.messages)) {
        const formatted: ChatMessage[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
        }));
        setMessages(formatted);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'メッセージの取得に失敗しました';
      setError(msg);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

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
  }, []);

  // 新規セッション作成
  const createSession = useCallback(
    async (novelId?: string | null, initialTitle?: string): Promise<ChatSession | null> => {
      const targetNovelId = novelId !== undefined ? novelId : selectedNovelIdRef.current;
      try {
        const created = await createChatSession({
          novelId: targetNovelId || undefined,
          title: initialTitle || '新しい相談',
        });
        setSessions((prev) => [
          created,
          ...(Array.isArray(prev) ? prev.filter((s) => s.id !== created.id) : []),
        ]);
        setCurrentSessionId(created.id);
        setMessages([]);
        setError(null);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'セッションの作成に失敗しました';
        setError(msg);
        return null;
      }
    },
    [],
  );

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
    [isStreaming, loadSessionMessages],
  );

  // セッション削除
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => (Array.isArray(prev) ? prev.filter((s) => s.id !== sessionId) : []));
      if (currentSessionIdRef.current === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'セッションの削除に失敗しました';
      setError(msg);
    }
  }, []);

  // セッションタイトル更新
  const updateSessionTitle = useCallback(async (sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      const updated = await updateChatSession(sessionId, { title: trimmed });
      setSessions((prev) =>
        Array.isArray(prev) ? prev.map((s) => (s.id === sessionId ? updated : s)) : [],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'タイトルの更新に失敗しました';
      setError(msg);
    }
  }, []);

  // セッション一覧のリフレッシュ
  const refreshSessions = useCallback(async () => {
    await fetchSessions(selectedNovelIdRef.current);
  }, [fetchSessions]);

  // 小説変更ハンドラ
  const setSelectedNovelId = useCallback(
    (id: string | null) => {
      setSelectedNovelIdState(id);
      setCurrentSessionId(null);
      setMessages([]);
      setError(null);
      void fetchSessions(id);
    },
    [fetchSessions],
  );

  // 初回ロードまたは小説ID変更時にセッション一覧を取得
  useEffect(() => {
    void fetchSessions(selectedNovelId);
  }, [selectedNovelId, fetchSessions]);

  const openChat = useCallback(
    (targetNovelId?: string | null) => {
      if (targetNovelId !== undefined && targetNovelId !== selectedNovelIdRef.current) {
        setSelectedNovelId(targetNovelId);
      }
      setIsOpen(true);
    },
    [setSelectedNovelId],
  );

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    if (streamingContent) {
      const partialMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: streamingContent + '\n\n*(中断されました)*',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, partialMsg]);
      setStreamingContent('');
    }
  }, [streamingContent]);

  const clearMessages = useCallback(() => {
    abortStream();
    if (currentSessionId) {
      void deleteSession(currentSessionId);
    } else {
      setMessages([]);
      setError(null);
    }
  }, [abortStream, currentSessionId, deleteSession]);

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isStreaming) return;

      setError(null);

      let activeSessionId = currentSessionIdRef.current;

      // まだセッションがない場合は新規セッションを作成
      if (!activeSessionId) {
        const titleProposal = text.slice(0, 30).trim().replace(/\n+/g, ' ') || '新しい相談';
        const newSession = await createSession(selectedNovelIdRef.current, titleProposal);
        if (newSession) {
          activeSessionId = newSession.id;
        }
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      setIsStreaming(true);
      setStreamingContent('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulated = '';

      try {
        await streamChat({
          sessionId: activeSessionId,
          novelId: selectedNovelIdRef.current,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          signal: controller.signal,
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamingContent(accumulated);
          },
          onError: (err) => {
            setError(err.message);
          },
        });

        if (!controller.signal.aborted && accumulated.trim()) {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: accumulated,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          // セッション一覧を再取得（自動タイトル更新や更新日時の反映）
          void refreshSessions();
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const errorMsg = err instanceof Error ? err.message : 'チャットエラーが発生しました';
        setError(errorMsg);
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortControllerRef.current = null;
      }
    },
    [createSession, isStreaming, messages, refreshSessions],
  );

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        openChat,
        closeChat,
        toggleChat,
        selectedNovelId,
        setSelectedNovelId,

        sessions,
        currentSessionId,
        currentSession,
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
