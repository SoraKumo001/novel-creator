import { useCallback, useRef, useState, type RefObject } from 'react';
import { createChatSession, deleteChatSession } from '@/lib/services/index.js';
import { streamChat } from '@/lib/chatApi.js';
import type { ChatSession } from '@/lib/types.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

/** チャットのストリーミング状態機械に必要なセッション層の入力 */
export interface UseChatStreamingInput {
  /** 選択中の小説ID（最新値を同期参照するための ref） */
  selectedNovelIdRef: RefObject<string | null>;
  /** セッション一覧のリフレッシュ（クエリの invalidate をラップしたもの） */
  refreshSessions: () => Promise<void>;
}

/**
 * チャットのメッセージ・ストリーミング状態機械を担うフック。
 * セッションの自動作成・削除・送信・中断・全消去の各処理と、
 * currentSessionId の状態をここで一元管理する。
 * セッション一覧の取得自体は ChatContext 側の useQuery が行うため、
 * selectedNovelIdRef と refreshSessions を注入して連携する。
 */
export function useChatStreaming({ selectedNovelIdRef, refreshSessions }: UseChatStreamingInput) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  // 新規セッション作成
  const createSession = useCallback(
    async (novelId?: string | null, initialTitle?: string): Promise<ChatSession | null> => {
      const targetNovelId = novelId !== undefined ? novelId : selectedNovelIdRef.current;
      try {
        const created = await createChatSession({
          novelId: targetNovelId || undefined,
          title: initialTitle || '新しい相談',
        });
        setCurrentSessionId(created.id);
        setMessages([]);
        setError(null);
        // セッション一覧を再取得して新規セッションを反映する
        await refreshSessions();
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'セッションの作成に失敗しました';
        setError(msg);
        return null;
      }
    },
    [refreshSessions, selectedNovelIdRef],
  );

  // セッション削除
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId);
        await refreshSessions();
        if (currentSessionIdRef.current === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'セッションの削除に失敗しました';
        setError(msg);
      }
    },
    [refreshSessions],
  );

  // ストリーミング中断（部分応答をメッセージとして確定する）
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

  // メッセージ全消去（紐づくセッションごと削除する）
  const clearMessages = useCallback(() => {
    abortStream();
    if (currentSessionId) {
      void deleteSession(currentSessionId);
    } else {
      setMessages([]);
      setError(null);
    }
  }, [abortStream, currentSessionId, deleteSession]);

  // メッセージ送信（セッション自動作成 → SSE ストリーミング）
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

  return {
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    streamingContent,
    setStreamingContent,
    error,
    setError,
    abortControllerRef,
    createSession,
    deleteSession,
    sendMessage,
    abortStream,
    clearMessages,
  };
}
