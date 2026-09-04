import { useCallback, useState } from "react";
import { useToast } from "@/hooks/useToast.js";

export interface UseChatDrawerClipboardReturn {
  copiedId: string | null;
  copyNotice: string | null;
  handleCopy: (content: string, id: string) => Promise<void>;
}

/**
 * メッセージコピー責務の切り出し（クリップボード＋フィードバック表示）。
 * 成功/失敗時の文言・表示期間（2000ms）は変更しない。
 */
export function useChatDrawerClipboard(): UseChatDrawerClipboardReturn {
  const toast = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (content: string, id: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setCopyNotice("メッセージをコピーしました");
        toast.success("メッセージをコピーしました");
        window.setTimeout(() => {
          setCopiedId(null);
          setCopyNotice(null);
        }, 2000);
      } catch {
        setCopyNotice("コピーできませんでした");
        toast.error("コピーできませんでした");
      }
    },
    [toast]
  );

  return { copiedId, copyNotice, handleCopy };
}
