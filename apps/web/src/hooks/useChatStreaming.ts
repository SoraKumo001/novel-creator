import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { createChatSession, deleteChatSession, updateChatSession } from '@/lib/services/index.js';
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

/** UI Message からテキストパーツのみを連結して取り出す */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/**
 * セッション詳細（DB行）を UI Message に変換して useChat へ seed する。
 * parts があればそれをそのまま使い、無ければ text パーツを合成する。
 * サーバーはリクエストの最後のユーザーメッセージのみを採用し履歴は DB から
 * 構築するため、ここでは id/role/parts を正しく設定する。
 */
export function rowToUIMessage(row: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts?: unknown[] | null;
}): UIMessage {
  const parts: UIMessage['parts'] =
    Array.isArray(row.parts) && row.parts.length > 0
      ? (row.parts as UIMessage['parts'])
      : [{ type: 'text', text: row.content, state: 'done' }];
  return {
    id: row.id,
    role: row.role,
    parts,
  };
}

/** 応答メッセージからタイトル案（〜30文字）を生成する */
function extractTitle(message: UIMessage): string {
  const text = textOf(message).trim();
  return text.replace(/\s+/g, ' ').slice(0, 30);
}

/**
 * チャットのメッセージ・ストリーミング状態機械を担うフック。
 * AI SDK（@ai-sdk/react の useChat + DefaultChatTransport）を使って
 * '/api/chat' への送信と UI Message Stream の受信を行う。
 *
 * セッションの自動作成・削除・送信・中断・全消去の各処理と、
 * currentSessionId の状態をここで一元管理する。
 * セッション一覧の取得自体は ChatContext 側の useQuery が行うため、
 * selectedNovelIdRef と refreshSessions を注入して連携する。
 */
export function useChatStreaming({ selectedNovelIdRef, refreshSessions }: UseChatStreamingInput) {
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(() => {
    return localStorage.getItem('novel-creator:chat-model') || null;
  });
  const selectedModelConfigIdRef = useRef<string | null>(selectedModelConfigId);
  selectedModelConfigIdRef.current = selectedModelConfigId;

  const [error, setError] = useState<string | null>(null);

  // sessionId を同期参照するための ref。
  // createSession 直後など state 反映前でも transport から最新値を読めるようにする。
  const sessionIdRef = useRef<string | null>(null);

  // selectedNovelId は外部（ChatContext）から ref で注入されるため、
  // 最新値を毎レンダーで live な ref にコピーして stale closure を避ける。
  const selectedNovelIdLiveRef = useRef<string | null>(selectedNovelIdRef.current);
  selectedNovelIdLiveRef.current = selectedNovelIdRef.current;

  // 新規セッションの初回応答後にタイトルを応答から設定するためのフラグ
  const autoCreatedSessionRef = useRef<string | null>(null);

  // state の currentSessionId を同期更新するラッパー
  const setCurrentSessionId = useCallback((id: string | null) => {
    currentSessionIdRef.current = id;
    sessionIdRef.current = id;
    setCurrentSessionIdState(id);
  }, []);

  const handleSetSelectedModelConfigId = useCallback((id: string | null) => {
    setSelectedModelConfigId(id);
    selectedModelConfigIdRef.current = id;
    if (id) {
      localStorage.setItem('novel-creator:chat-model', id);
    } else {
      localStorage.removeItem('novel-creator:chat-model');
    }
  }, []);

  // 送信時に毎回 sessionId / novelId / modelConfigId を ref 経由で最新値を埋め込む。
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            sessionId: sessionIdRef.current,
            novelId: selectedNovelIdLiveRef.current,
            messages,
            modelConfigId: selectedModelConfigIdRef.current,
          },
        }),
      }),
    [],
  );

  const {
    messages: uiMessages,
    setMessages: setUiMessages,
    sendMessage: chatSendMessage,
    stop,
    status,
    error: chatError,
  } = useChat({
    id: 'main-chat',
    transport,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'チャットエラーが発生しました');
    },
    onFinish: ({ isAbort, isError, message }) => {
      if (isAbort || isError) return;
      // 新規セッションの初回応答完了後: 応答テキストからタイトル案を PUT + 一覧再取得
      if (
        autoCreatedSessionRef.current &&
        autoCreatedSessionRef.current === currentSessionIdRef.current
      ) {
        autoCreatedSessionRef.current = null;
        const title = extractTitle(message);
        if (title && currentSessionIdRef.current) {
          void updateChatSession(currentSessionIdRef.current, { title }).catch(() => {});
        }
      }
      void refreshSessions();
    },
  });

  // useChat の error 状態を既存の error 文字列 state に同期する
  useEffect(() => {
    if (chatError) {
      setError(chatError.message);
    }
  }, [chatError]);

  // 公開 API 用の派生値
  const isStreaming = status === 'submitted' || status === 'streaming';

  // 画面に表示する確定済みメッセージ。
  // ストリーミング中のアシスタント部分応答は streamingContent 側で表示するため除外する。
  const messages: ChatMessage[] = useMemo(() => {
    return uiMessages
      .filter((m) => {
        // ストリーミング中（state==='streaming' の text パーツを持つ）の
        // アシスタントメッセージは streamingContent で表示するため除外する
        const hasStreamingText = m.parts.some((p) => p.type === 'text' && p.state === 'streaming');
        return !hasStreamingText;
      })
      .map((m) => ({
        id: m.id,
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: textOf(m),
        createdAt: Date.now(),
      }))
      .filter((m) => m.content !== '');
  }, [uiMessages]);

  // ストリーミング中のリアルタイム表示用テキスト
  const streamingContent = useMemo(() => {
    if (!isStreaming) return '';
    const last = uiMessages[uiMessages.length - 1];
    if (!last || last.role !== 'assistant') return '';
    return textOf(last);
  }, [uiMessages, isStreaming]);

  // 下位コンポーネント（ChatContext 内）が abort のために参照する互換 shim。
  // useChat の stop() を呼ぶ。
  const stopFnRef = useRef<() => void>(() => {});
  stopFnRef.current = () => {
    void stop();
  };
  const abortControllerRef = useRef<{ abort: () => void } | null>(null);
  abortControllerRef.current = { abort: () => stopFnRef.current() };

  // 既存コンテキストからのリセット呼び出しに応える互換 no-op setter。
  // 実ストリーミング状態は useChat の status から導出するため state は持たない。
  const setIsStreaming = useCallback((_value: boolean) => {}, []);
  const setStreamingContent = useCallback((_value: string) => {}, []);

  // 新規セッション作成
  const createSession = useCallback(
    async (novelId?: string | null, initialTitle?: string): Promise<ChatSession | null> => {
      const targetNovelId = novelId !== undefined ? novelId : selectedNovelIdLiveRef.current;
      try {
        const created = await createChatSession({
          novelId: targetNovelId || undefined,
          title: initialTitle || '新しい相談',
        });
        setCurrentSessionId(created.id);
        setUiMessages([]);
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
    [refreshSessions, setCurrentSessionId, setUiMessages],
  );

  // セッション削除
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId);
        await refreshSessions();
        if (currentSessionIdRef.current === sessionId) {
          setCurrentSessionId(null);
          setUiMessages([]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'セッションの削除に失敗しました';
        setError(msg);
      }
    },
    [refreshSessions, setCurrentSessionId, setUiMessages],
  );

  // ストリーミング中断（部分応答をメッセージとして確定する）
  const abortStream = useCallback(async () => {
    await stop();
    // 部分応答（streaming の text パーツ）を done に確定して画面に残す
    setUiMessages((prev) =>
      prev.map((m, idx) => {
        if (idx !== prev.length - 1 || m.role !== 'assistant') return m;
        const hasStreaming = m.parts.some((p) => p.type === 'text' && p.state === 'streaming');
        if (!hasStreaming) return m;
        return {
          ...m,
          parts: m.parts.map((p) =>
            p.type === 'text' && p.state === 'streaming' ? { ...p, state: 'done' } : p,
          ),
        };
      }),
    );
  }, [setUiMessages, stop]);

  // メッセージ全消去（紐づくセッションごと削除する）
  const clearMessages = useCallback(() => {
    void abortStream();
    if (currentSessionIdRef.current) {
      void deleteSession(currentSessionIdRef.current);
    } else {
      setUiMessages([]);
      setError(null);
    }
  }, [abortStream, deleteSession, setUiMessages]);

  // メッセージ送信（セッション自動作成 → AI SDK ストリーミング）
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isStreaming) return;

      setError(null);

      let activeSessionId = currentSessionIdRef.current;

      // まだセッションがない場合は新規セッションを作成
      if (!activeSessionId) {
        const titleProposal = text.slice(0, 30).trim().replace(/\n+/g, ' ') || '新しい相談';
        const newSession = await createSession(selectedNovelIdLiveRef.current, titleProposal);
        if (!newSession) return;
        activeSessionId = newSession.id;
        autoCreatedSessionRef.current = activeSessionId;
      }

      // AI SDK がユーザーメッセージを追加して送信する
      await chatSendMessage({ text });
    },
    [createSession, chatSendMessage, isStreaming],
  );

  return {
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    selectedModelConfigId,
    setSelectedModelConfigId: handleSetSelectedModelConfigId,
    messages,
    setMessages: setUiMessages,
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
