import type { UIMessage } from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseChatDrawerScrollOptions {
  /** ドロワー開閉状態（初期スクロール effect の発火条件） */
  isOpen: boolean;
  /** ストリーミング中か（追従 effect の発火条件） */
  isStreaming: boolean;
  /** messages.length（新規メッセージ追加検知用の再実行トリガー） */
  messageCount: number;
  /** 履歴表示中か（初期スクロール effect の発火条件） */
  showHistoryView: boolean;
  /** ストリーミング表示テキスト（追従 effect の再実行トリガー） */
  streamingContent: string;
  /** ストリーミング表示パーツ（追従 effect の再実行トリガー） */
  streamingParts: UIMessage["parts"] | null;
  /** 入力欄 ref（オープン時の初期フォーカス用） */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export interface UseChatDrawerScrollReturn {
  handleMessagesScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isPinnedToBottom: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
  showJumpButton: boolean;
}

/**
 * スクロール追従責務の切り出し。
 * useEffect の発火条件・ガード・rAF による追従制御は変更しない。
 */
export function useChatDrawerScroll({
  isStreaming,
  isOpen,
  messageCount,
  showHistoryView,
  streamingContent,
  streamingParts,
  textareaRef,
}: UseChatDrawerScrollOptions): UseChatDrawerScrollReturn {
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const showJumpButton = !isPinnedToBottom;

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) {
      return;
    }
    isUserScrolledUpRef.current = false;
    setIsPinnedToBottom(true);
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
      isUserScrolledUpRef.current = !isAtBottom;
      setIsPinnedToBottom(isAtBottom);
    },
    []
  );

  // チャットオープン時や履歴切り替え時の初期スクロール & フォーカス
  useEffect(() => {
    if (isOpen && !showHistoryView) {
      isUserScrolledUpRef.current = false;
      setIsPinnedToBottom(true);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
      textareaRef.current?.focus();
    }
  }, [isOpen, showHistoryView, textareaRef]);

  // 新規メッセージ追加時のスクロール（遡読中は追従しない）
  useEffect(() => {
    // messageCount は再実行トリガー（新規メッセージ追加時に末尾へスクロールする）
    void messageCount;
    if (isOpen && !showHistoryView && !isUserScrolledUpRef.current) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messageCount, isOpen, showHistoryView]);

  // ストリーミング中の自動スクロール追従（追従停止中は止める）
  useEffect(() => {
    // streamingContent / streamingParts は再実行トリガー（チャンク受信ごとに追従する）
    void streamingContent;
    void streamingParts;
    if (!isStreaming || isUserScrolledUpRef.current) {
      return;
    }
    if (scrollRafRef.current == null) {
      scrollRafRef.current = requestAnimationFrame(() => {
        if (messagesContainerRef.current && !isUserScrolledUpRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
        scrollRafRef.current = null;
      });
    }
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [streamingContent, streamingParts, isStreaming]);

  return {
    handleMessagesScroll,
    isPinnedToBottom,
    messagesContainerRef,
    scrollToBottom,
    showJumpButton,
  };
}
