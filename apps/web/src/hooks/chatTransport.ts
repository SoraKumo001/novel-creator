import { DefaultChatTransport, type UIMessage } from "ai";
import type { RefObject } from "react";
import { useMemo } from "react";

/** sessionStorage 上のメッセージキャッシュ接頭辞 */
export const CHAT_MESSAGES_CACHE_PREFIX = "novel-creator:chat-cache:";

/** キャッシュに保持する最大件数（全文保存をやめ直近のみに軽量化する） */
export const CHAT_CACHE_MAX_MESSAGES = 50;

/** セッションごとのメッセージキャッシュキー */
export function chatCacheKey(sessionId: string): string {
  return `${CHAT_MESSAGES_CACHE_PREFIX}${sessionId}`;
}

/** キャッシュ済みメッセージの読み出し（失敗時は null を返すベストエフォート） */
export function loadCachedMessages(sessionId: string): UIMessage[] | null {
  try {
    const cached = sessionStorage.getItem(chatCacheKey(sessionId));
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached) as UIMessage[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** キャッシュ済みメッセージの保存（直近のみ・ベストエフォート）。
 * QuotaExceededError 等で失敗しても呼び出し元の error state には波及させず
 * 静かに破棄する（リロード後の復元用キャッシュのため送信結果に影響しない）。
 */
export function saveCachedMessages(
  sessionId: string,
  messages: UIMessage[]
): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    const recent = messages.slice(-CHAT_CACHE_MAX_MESSAGES);
    sessionStorage.setItem(chatCacheKey(sessionId), JSON.stringify(recent));
  } catch {
    // キャッシュはベストエフォートのため静かに破棄する
  }
}
/**
 * 送信時に毎回 sessionId / novelId / modelConfigId を ref 経由で最新値を埋め込む
 * DefaultChatTransport を生成する。API リクエスト形状は変更しない。
 */
export function useChatTransport({
  sessionIdRef,
  selectedNovelIdLiveRef,
  selectedModelConfigIdRef,
}: {
  sessionIdRef: RefObject<string | null>;
  selectedNovelIdLiveRef: RefObject<string | null>;
  selectedModelConfigIdRef: RefObject<string | null>;
}) {
  return useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            sessionId: sessionIdRef.current,
            novelId: selectedNovelIdLiveRef.current,
            messages,
            modelConfigId: selectedModelConfigIdRef.current,
          },
        }),
      }),
    [sessionIdRef, selectedNovelIdLiveRef, selectedModelConfigIdRef]
  );
}
