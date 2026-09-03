import type { UIMessage } from "ai";
import { type RefObject, useCallback, useRef } from "react";
import { createChatSession, deleteChatSession } from "@/lib/services/index.js";
import type { ChatSession } from "@/lib/types.js";
import type { ChatMessage } from "./chatStreamingTypes.js";

interface UseChatActionsInput {
  autoCreatedSessionRef: RefObject<string | null>;
  chatSendMessage: (message: { text: string }) => Promise<void>;
  currentSessionIdRef: RefObject<string | null>;
  isStreaming: boolean;
  messages: ChatMessage[];
  refreshSessions: () => Promise<void>;
  selectedNovelIdLiveRef: RefObject<string | null>;
  setCurrentSessionId: (id: string | null) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setUiMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  stop: () => Promise<void>;
}

interface UseChatActionsResult {
  abortStream: () => Promise<void>;
  abortStreamDiscard: () => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
  createSession: (
    novelId?: string | null,
    initialTitle?: string
  ) => Promise<ChatSession | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  lastPromptRef: RefObject<string | null>;
  retryLastMessage: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

/**
 * セッション操作・送信・中断・再試行のアクション群。
 * useChatStreaming の単一 source の一部として切り出したもの。
 * 振る舞い（自動セッション作成・部分応答の確定/破棄・lastPrompt 記憶）は変更しない。
 */
export function useChatActions({
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
}: UseChatActionsInput): UseChatActionsResult {
  // 新規セッション作成
  const createSession = useCallback(
    async (
      novelId?: string | null,
      initialTitle?: string
    ): Promise<ChatSession | null> => {
      const targetNovelId =
        novelId !== undefined ? novelId : selectedNovelIdLiveRef.current;
      try {
        const created = await createChatSession({
          novelId: targetNovelId || undefined,
          title: initialTitle || "新しい相談",
        });
        setCurrentSessionId(created.id);
        setUiMessages([]);
        setError(null);
        // セッション一覧を再取得して新規セッションを反映する
        await refreshSessions();
        return created;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "セッションの作成に失敗しました";
        setError(msg);
        return null;
      }
    },
    [
      refreshSessions,
      setCurrentSessionId,
      setUiMessages,
      setError,
      selectedNovelIdLiveRef,
    ]
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
        const msg =
          err instanceof Error ? err.message : "セッションの削除に失敗しました";
        setError(msg);
      }
    },
    [
      refreshSessions,
      setCurrentSessionId,
      setUiMessages,
      setError,
      currentSessionIdRef,
    ]
  );

  // ストリーミング中断（部分応答をメッセージとして確定する）
  const abortStream = useCallback(async () => {
    await stop();
    // 部分応答（streaming の text パーツ）を done に確定して画面に残す
    setUiMessages((prev) =>
      prev.map((m, idx) => {
        if (idx !== prev.length - 1 || m.role !== "assistant") {
          return m;
        }
        const hasStreaming = m.parts.some(
          (p) => p.type === "text" && p.state === "streaming"
        );
        if (!hasStreaming) {
          return m;
        }
        return {
          ...m,
          parts: m.parts.map((p) =>
            p.type === "text" && p.state === "streaming"
              ? { ...p, state: "done" }
              : p
          ),
        };
      })
    );
  }, [setUiMessages, stop]);

  // ストリーミング中断（部分応答を破棄する）。
  // abortStream() と異なり部分応答を done 化しないため、state==='streaming' の
  // text パーツを持つメッセージは messages から除外され続け、画面上から消える
  // （= 破棄される）。セッション切り替えや新規チャット開始のように、
  // 直後にメッセージ一覧を差し替える呼び出し側向けの中断手段。
  const abortStreamDiscard = useCallback(async () => {
    await stop();
  }, [stop]);

  // メッセージ全消去（紐づくセッションごと削除する）
  const clearMessages = useCallback(() => {
    void abortStream();
    if (currentSessionIdRef.current) {
      void deleteSession(currentSessionIdRef.current);
    } else {
      setUiMessages([]);
      setError(null);
    }
  }, [
    abortStream,
    deleteSession,
    setUiMessages,
    setError,
    currentSessionIdRef,
  ]);

  // 送信した最後のプロンプトを再試行用に記憶する
  const lastPromptRef = useRef<string | null>(null);

  // メッセージ送信（セッション自動作成 → AI SDK ストリーミング）
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isStreaming) {
        return;
      }

      lastPromptRef.current = text;
      setError(null);

      let activeSessionId = currentSessionIdRef.current;

      // まだセッションがない場合は新規セッションを作成
      if (!activeSessionId) {
        const titleProposal =
          text.slice(0, 30).trim().replace(/\n+/g, " ") || "新しい相談";
        const newSession = await createSession(
          selectedNovelIdLiveRef.current,
          titleProposal
        );
        if (!newSession) {
          return;
        }
        activeSessionId = newSession.id;
        autoCreatedSessionRef.current = activeSessionId;
      }

      // AI SDK がユーザーメッセージを追加して送信する
      await chatSendMessage({ text });
    },
    [
      createSession,
      chatSendMessage,
      isStreaming,
      autoCreatedSessionRef,
      currentSessionIdRef,
      selectedNovelIdLiveRef,
      setError,
    ]
  );

  // 直前のメッセージを再試行する
  const retryLastMessage = useCallback(async () => {
    if (isStreaming) {
      return;
    }
    const lastUserPrompt =
      lastPromptRef.current ??
      [...messages].reverse().find((m) => m.role === "user")?.content;
    if (!lastUserPrompt) {
      return;
    }
    await sendMessage(lastUserPrompt);
  }, [messages, sendMessage, isStreaming]);

  // エラー表示を消去する
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    abortStream,
    abortStreamDiscard,
    clearError,
    clearMessages,
    createSession,
    deleteSession,
    lastPromptRef,
    retryLastMessage,
    sendMessage,
  };
}
