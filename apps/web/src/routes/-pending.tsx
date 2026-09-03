/**
 * ルートのコード分割（lazy chunk）読み込み中に表示される軽量な pending フォールバック。
 * 全ルートの `pendingComponent` で共有する。
 */
import { Loading } from "@/components/Loading.js";

export function RoutePending() {
  return (
    <div className="flex min-h-40 w-full items-center justify-center">
      <Loading />
    </div>
  );
}
