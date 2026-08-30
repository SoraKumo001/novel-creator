import type { EditableCharacter, EntityAction } from './types.js';

interface ChatInsertCharacterTabProps {
  characters: EditableCharacter[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof EditableCharacter, value: unknown) => void;
}

export function ChatInsertCharacterTab({
  characters,
  onToggle,
  onRemove,
  onUpdate,
}: ChatInsertCharacterTabProps) {
  if (characters.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        検出された登場人物はありませんでした。「＋ 人物を手動追加」から追加できます。
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {characters.map((char) => (
        <div
          key={char._id}
          className={`rounded-xl border p-3 transition ${
            char._selected
              ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-600/60 dark:bg-indigo-950/20'
              : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={char._selected}
                onChange={() => onToggle(char._id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
              />
            </div>

            <div className="flex-1 space-y-2">
              {/* 既存データとの重複判定 & アクション選択 */}
              {char.matchedExisting ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ 既存の人物「{char.matchedExisting.name}」と名前が一致
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-slate-600 dark:text-slate-300">
                      反映方法:
                    </label>
                    <select
                      value={char.action}
                      onChange={(e) => onUpdate(char._id, 'action', e.target.value as EntityAction)}
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none dark:border-amber-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="overwrite">上書き更新</option>
                      <option value="merge">追記マージ</option>
                      <option value="create">新規追加（同名別件）</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✨ 新規追加
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                    名前
                  </label>
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => onUpdate(char._id, 'name', e.target.value)}
                    placeholder="例: アリス・フォーサイス"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                    役割・カテゴリ
                  </label>
                  <input
                    type="text"
                    value={char.category}
                    onChange={(e) => onUpdate(char._id, 'category', e.target.value)}
                    placeholder="例: 主人公, 敵対者"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                  特徴・属性タグ（カンマ区切り）
                </label>
                <input
                  type="text"
                  value={char.traitsString}
                  onChange={(e) => onUpdate(char._id, 'traitsString', e.target.value)}
                  placeholder="例: 銀髪, 剣術, 冷静沈着"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                  説明・背景・動機
                </label>
                <textarea
                  rows={2}
                  value={char.description || ''}
                  onChange={(e) => onUpdate(char._id, 'description', e.target.value)}
                  placeholder="人物の外見、性格、目的などの説明"
                  className="w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(char._id)}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
