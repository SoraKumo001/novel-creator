/**
 * ルートのコード分割（lazy chunk）読み込み中に表示される軽量な pending フォールバック。
 * 全ルートの `pendingComponent` で共有する。
 */
export function RoutePending() {
  return (
    <div className="flex min-h-40 w-full items-center justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
