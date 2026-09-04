import { DefaultChatTransport } from "ai";
import type { RefObject } from "react";
import { useMemo } from "react";
import {
  CHAT_CACHE_MAX_MESSAGES,
  CHAT_MESSAGES_CACHE_PREFIX,
  chatCacheKey,
  loadCachedMessages,
  saveCachedMessages,
} from "@/lib/chat-storage.js";

// 互換のための再エクスポート（既存の import パスを維持する）。
// 実体は `@/lib/chat-storage` に集約されている。
export {
  CHAT_CACHE_MAX_MESSAGES,
  CHAT_MESSAGES_CACHE_PREFIX,
  chatCacheKey,
  loadCachedMessages,
  saveCachedMessages,
};
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
