import type { ForeshadowingStatus } from "@/lib/types.js";
import type { EditableForeshadowing, EntityAction } from "./types.js";

interface ChatInsertForeshadowingTabProps {
  foreshadowings: EditableForeshadowing[];
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onUpdate: (
    id: string,
    field: keyof EditableForeshadowing,
    value: unknown
  ) => void;
}

export function ChatInsertForeshadowingTab({
  foreshadowings,
  onToggle,
  onRemove,
  onUpdate,
}: ChatInsertForeshadowingTabProps) {
  if (foreshadowings.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-xs">
        検出された伏線情報はありませんでした。「＋
        伏線を手動追加」から追加できます。
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {foreshadowings.map((f) => (
        <div
          key={f._id}
          className={`rounded-xl border p-3 transition ${
            f._selected
              ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-600/60 dark:bg-indigo-950/20"
              : "border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={f._selected}
                onChange={() => onToggle(f._id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
              />
            </div>

            <div className="flex-1 space-y-2">
              {/* 既存データとの重複判定 & アクション選択 */}
              {f.matchedExisting ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ 既存の伏線「{f.matchedExisting.title}」とタイトルが一致
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-slate-600 dark:text-slate-300">
                      反映方法:
                    </label>
                    <select
                      value={f.action}
                      onChange={(e) =>
                        onUpdate(
                          f._id,
                          "action",
                          e.target.value as EntityAction
                        )
                      }
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 text-slate-800 text-xs focus:outline-none dark:border-amber-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="overwrite">上書き更新</option>
                      <option value="merge">追記マージ</option>
                      <option value="create">新規追加（同名別件）</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-bold text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✨ 新規追加
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[10px] text-slate-500 uppercase">
                    伏線タイトル
                  </label>
                  <input
                    type="text"
                    value={f.title}
                    onChange={(e) => onUpdate(f._id, "title", e.target.value)}
                    placeholder="例: 古代のペンダントの謎"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 uppercase">
                    ステータス
                  </label>
                  <select
                    value={f.status}
                    onChange={(e) =>
                      onUpdate(
                        f._id,
                        "status",
                        e.target.value as ForeshadowingStatus
                      )
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="unresolved">未回収</option>
                    <option value="resolved">回収済</option>
                    <option value="abandoned">破棄</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[10px] text-slate-500 uppercase">
                  詳細説明（真相・回収案）
                </label>
                <textarea
                  rows={2}
                  value={f.description || ""}
                  onChange={(e) =>
                    onUpdate(f._id, "description", e.target.value)
                  }
                  placeholder="伏線の詳細や回収方法のアイデア"
                  className="w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(f._id)}
              className="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
              title="候補から削除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
