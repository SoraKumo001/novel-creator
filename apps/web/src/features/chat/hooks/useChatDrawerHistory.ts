import { useCallback, useState } from "react";
import type { ChatFocusContext } from "@/context/chatUiTypes.js";
import { usePinnedSessions } from "@/hooks/usePinnedSessions.js";
import { useToast } from "@/hooks/useToast.js";

export interface UseChatDrawerHistoryOptions {
  /** エディタから渡された未消費の相談フォーカス（新規開始時に消費） */
  chatFocus: ChatFocusContext | null;
  /** 相談フォーカスを消費済みにする */
  consumeFocus: () => void;
  /** 現在のセッションID（下書き退避・同一判定用） */
  currentSessionId: string | null;
  /** セッション削除（履歴一覧の更新を伴う） */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 入力中の下書き（切替時の退避・破棄確認用）。input hook の snapshot */
  inputValue: string;
  /** 返信中は切替前に確認する */
  isStreaming: boolean;
  /** input hook の下書き同期保存 */
  persistDraftSync: (sessionId: string | null, value: string) => void;
  /** input hook の入力初期化（新規開始時） */
  resetInputForNewChat: () => void;
  /** 選択中のモデル設定ID（同一判定用） */
  selectedModelConfigId: string | null;
  /** 選択中の小説ID（同一判定用） */
  selectedNovelId: string | null;
  /** セッション切替 */
  selectSession: (sessionId: string) => Promise<void>;
  /** モデル切替の反映先 */
  setSelectedModelConfigId: (id: string | null) => void;
  /** 小説切替の反映先 */
  setSelectedNovelId: (id: string | null) => void;
  /** 新規相談開始（画面クリア） */
  startNewChat: () => void;
  /** セッションタイトル更新 */
  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;
}

export interface UseChatDrawerHistoryReturn {
  handleModelChange: (id: string | null) => void;
  handleNovelChange: (id: string | null) => void;
  handleSelectSession: (id: string) => void;
  handleStartNewChat: () => void;
  onDeleteSession: (id: string) => Promise<void>;
  onSaveTitle: (id: string, newTitle: string) => Promise<boolean>;
  pinnedIds: Set<string>;
  setShowHistoryView: (v: boolean | ((prev: boolean) => boolean)) => void;
  showHistoryView: boolean;
  togglePin: (id: string) => void;
}

/**
 * 履歴・セッション切替責務の切り出し。
 * 新規開始・セッション選択・小説/モデル切替の破棄防止確認と、
 * タイトル変更・削除・ピン留めを担う。確認文言・ガード条件は変更しない。
 */
export function useChatDrawerHistory({
  chatFocus,
  consumeFocus,
  currentSessionId,
  deleteSession,
  inputValue,
  isStreaming,
  persistDraftSync,
  resetInputForNewChat,
  selectedModelConfigId,
  selectedNovelId,
  selectSession,
  setSelectedModelConfigId,
  setSelectedNovelId,
  startNewChat,
  updateSessionTitle,
}: UseChatDrawerHistoryOptions): UseChatDrawerHistoryReturn {
  const toast = useToast();
  const [showHistoryView, setShowHistoryView] = useState(false);
  const { pinnedIds, togglePin } = usePinnedSessions();

  const handleStartNewChat = useCallback(() => {
    if (isStreaming) {
      const ok = window.confirm(
        "AIが返信を作成中です。新規相談を始めると返信が止まります。続けますか？入力中の下書きは自動保存されます。"
      );
      if (!ok) {
        return;
      }
    }
    persistDraftSync(currentSessionId, inputValue);
    setShowHistoryView(false);
    resetInputForNewChat();
    if (chatFocus) {
      consumeFocus();
    }
    startNewChat();
  }, [
    isStreaming,
    persistDraftSync,
    currentSessionId,
    inputValue,
    resetInputForNewChat,
    chatFocus,
    consumeFocus,
    startNewChat,
  ]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === currentSessionId) {
        setShowHistoryView(false);
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。別の相談に切り替えると返信が止まります。切り替えますか？入力中の下書きは自動保存されます。"
        );
        if (!ok) {
          return;
        }
      }
      persistDraftSync(currentSessionId, inputValue);
      void selectSession(id);
      setShowHistoryView(false);
    },
    [currentSessionId, isStreaming, persistDraftSync, inputValue, selectSession]
  );

  // 小説切替の破棄防止（未送信入力あり or 返信中は確認する）
  const handleNovelChange = useCallback(
    (id: string | null) => {
      if (id === selectedNovelId) {
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。対象の小説を切り替えると返信が止まります。切り替えますか？入力中の下書きは自動保存されます。"
        );
        if (!ok) {
          return;
        }
      } else if (inputValue.trim()) {
        const ok = window.confirm(
          "入力中の下書きがあります。切り替えても下書きは自動保存され、戻すと復元されます。切り替えますか？"
        );
        if (!ok) {
          return;
        }
      }
      persistDraftSync(currentSessionId, inputValue);
      setSelectedNovelId(id);
    },
    [
      selectedNovelId,
      isStreaming,
      inputValue,
      persistDraftSync,
      currentSessionId,
      setSelectedNovelId,
    ]
  );

  // モデル切替の破棄防止（返信中は確認する）
  const handleModelChange = useCallback(
    (id: string | null) => {
      if (id === selectedModelConfigId) {
        return;
      }
      if (isStreaming) {
        const ok = window.confirm(
          "AIが返信を作成中です。モデルを切り替えると次の返信から反映されます。切り替えますか？"
        );
        if (!ok) {
          return;
        }
      }
      setSelectedModelConfigId(id);
    },
    [selectedModelConfigId, isStreaming, setSelectedModelConfigId]
  );

  const onSaveTitle = useCallback(
    async (id: string, newTitle: string) => {
      const ok = await updateSessionTitle(id, newTitle);
      if (ok) {
        toast.success("タイトルを変更しました");
      } else {
        toast.error("タイトルの変更に失敗しました");
      }
      return ok;
    },
    [updateSessionTitle, toast]
  );

  const onDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
        toast.success("相談履歴を削除しました");
      } catch {
        toast.error("削除に失敗しました");
      }
    },
    [deleteSession, toast]
  );

  return {
    handleModelChange,
    handleNovelChange,
    handleSelectSession,
    handleStartNewChat,
    onDeleteSession,
    onSaveTitle,
    pinnedIds,
    setShowHistoryView,
    showHistoryView,
    togglePin,
  };
}
