import { useCallback, useState } from "react";

/**
 * モーダルの開閉状態のみを管理するフック。
 * 結果（result）やエラー（error）をモーダル内に表示する場合は useModalResultState を使う。
 *
 * TPayload を指定すると「開く対象」をモーダル状態に持たせられる
 * （例: 削除確認ダイアログの削除対象 ID。open(id) で開き、close() で payload も null に戻る）。
 * payload 型を指定した場合の open は引数必須のため、onClick 等に誤って
 * イベントオブジェクトが payload として渡ることを型で防ぐ。
 */
interface ModalStateControls<TPayload> {
  close: () => void;
  isOpen: boolean;
  open: TPayload extends void ? () => void : (payload: TPayload) => void;
  payload: TPayload | null;
}

export function useModalState<TPayload = void>(): ModalStateControls<TPayload> {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<TPayload | null>(null);

  const openInternal = useCallback((p?: TPayload) => {
    if (p !== undefined) {
      setPayload(p);
    }
    setIsOpen(true);
  }, []);

  const open = openInternal as ModalStateControls<TPayload>["open"];

  const close = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  return { isOpen, payload, open, close };
}

/**
 * モーダルの開閉状態に加えて、モーダル内に表示する結果（result）とエラー（error）を
 * 管理するフック。
 *
 * 注意: 開閉時の result / error の自動リセットは行わない。
 * リセットのタイミング（open 時にクリアするか、close 時にクリアするか）は
 * 既存の挙動を維持するため呼び出し側が setResult(null) / setError(null) を
 * 明示的に呼び出すこと。
 */
export function useModalResultState<T>() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close, result, setResult, error, setError };
}

/**
 * 分析結果モーダル（口調チェック・ペルソナレビュー・ストーリーアーク等）に共通する
 * 「履歴表示」状態（履歴ビュー / 表示中エントリの作成時刻 / 履歴一覧の更新キー）を管理するフック。
 */
export function useHistoryViewState() {
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [viewedAt, setViewedAt] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  /** 履歴エントリを表示モードにする（at にはエントリの createdAt を渡す） */
  const showHistory = useCallback((at: string) => {
    setIsHistoryView(true);
    setViewedAt(at);
  }, []);

  /** 再実行などで最新結果の表示に戻す（open 時などに呼ぶ。historyKey は据え置き） */
  const resetHistoryView = useCallback(() => {
    setIsHistoryView(false);
    setViewedAt(null);
  }, []);

  /** 新規実行の完了後に履歴一覧を再取得させるためのキーを進める */
  const bumpHistoryKey = useCallback(() => setHistoryKey((k) => k + 1), []);

  return {
    isHistoryView,
    viewedAt,
    historyKey,
    showHistory,
    resetHistoryView,
    bumpHistoryKey,
  };
}
