import type { EditableTimeline, EntityAction } from "./types.js";

interface ChatInsertTimelineTabProps {
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, field: keyof EditableTimeline, value: unknown) => void;
  timelines: EditableTimeline[];
}

export function ChatInsertTimelineTab({
  timelines,
  onToggle,
  onRemove,
  onUpdate,
}: ChatInsertTimelineTabProps) {
  if (timelines.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-xs">
        検出された時系列・出来事はありませんでした。「＋
        出来事を手動追加」から追加できます。
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {timelines.map((t) => (
        <div
          key={t._id}
          className={`rounded-xl border p-3 transition ${
            t._selected
              ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-600/60 dark:bg-indigo-950/20"
              : "border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={t._selected}
                onChange={() => onToggle(t._id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
              />
            </div>

            <div className="flex-1 space-y-2">
              {/* 既存データとの重複判定 & アクション選択 */}
              {t.matchedExisting ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ 類似の出来事「{t.matchedExisting.event}」が存在します
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-slate-600 dark:text-slate-300">
                      反映方法:
                    </label>
                    <select
                      value={t.action}
                      onChange={(e) =>
                        onUpdate(
                          t._id,
                          "action",
                          e.target.value as EntityAction
                        )
                      }
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 text-slate-800 text-xs focus:outline-none dark:border-amber-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="create">新規追加（別イベント）</option>
                      <option value="overwrite">上書き更新</option>
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
                    出来事・イベント内容
                  </label>
                  <input
                    type="text"
                    value={t.event}
                    onChange={(e) => onUpdate(t._id, "event", e.target.value)}
                    placeholder="例: 王都での決戦が勃発"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 uppercase">
                    作中時期・日時
                  </label>
                  <input
                    type="text"
                    value={t.timestamp || ""}
                    onChange={(e) =>
                      onUpdate(t._id, "timestamp", e.target.value)
                    }
                    placeholder="例: 帝都暦742年, 第2章開始直後"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(t._id)}
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
