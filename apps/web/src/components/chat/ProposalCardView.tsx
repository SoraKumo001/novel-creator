import type { ProposalPayload } from "./proposalTypes.js";

/**
 * 提案内容の表示部（presentational）。
 * proposalType ごとの本文プレビューを描画する。状態やイベントは持たない。
 */
export function ProposalCardBody({
  proposal,
  safeSectionName,
  targetNovelId,
}: {
  proposal: ProposalPayload;
  safeSectionName: string;
  targetNovelId: string;
}) {
  const { proposalType, data } = proposal;

  return (
    <div className="mt-2.5 rounded-lg border border-indigo-100/70 bg-white/90 p-2.5 text-slate-700 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
      {proposalType === "bulk" && (
        <div className="space-y-2">
          {(!Array.isArray(data.characters) || data.characters.length === 0) &&
            (!Array.isArray(data.settings) || data.settings.length === 0) &&
            (!Array.isArray(data.foreshadowings) ||
              data.foreshadowings.length === 0) &&
            (!Array.isArray(data.timelines) || data.timelines.length === 0) &&
            (!Array.isArray(data.deleteSettings) ||
              data.deleteSettings.length === 0) &&
            (!Array.isArray(data.deleteCharacters) ||
              data.deleteCharacters.length === 0) && (
              <div className="py-1 text-slate-500 text-xs">
                （登録・削除対象の項目はありません）
              </div>
            )}
          {Array.isArray(data.deleteSettings) &&
            data.deleteSettings.length > 0 && (
              <div className="rounded border border-rose-200 bg-rose-50/60 p-2 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="font-bold text-[11px] text-rose-700 dark:text-rose-400">
                  🗑️ 削除対象の世界観・設定 ({data.deleteSettings.length}件)
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.deleteSettings.map((name: string, i: number) => (
                    <span
                      key={i}
                      className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-[10px] text-rose-800 line-through dark:bg-rose-900/60 dark:text-rose-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          {Array.isArray(data.deleteCharacters) &&
            data.deleteCharacters.length > 0 && (
              <div className="rounded border border-rose-200 bg-rose-50/60 p-2 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="font-bold text-[11px] text-rose-700 dark:text-rose-400">
                  🗑️ 削除対象の登場人物 ({data.deleteCharacters.length}名)
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.deleteCharacters.map((name: string, i: number) => (
                    <span
                      key={i}
                      className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-[10px] text-rose-800 line-through dark:bg-rose-900/60 dark:text-rose-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          {Array.isArray(data.characters) && data.characters.length > 0 && (
            <div>
              <div className="font-bold text-[11px] text-indigo-700 dark:text-indigo-400">
                👤 登場人物 ({data.characters.length}名)
              </div>
              <div className="mt-1 space-y-1 border-indigo-200 border-l-2 pl-1.5 dark:border-indigo-800">
                {data.characters.map((c, i: number) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {" "}
                      ({c.category || "未分類"})
                    </span>
                    {c.description && (
                      <p className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                        {c.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(data.settings) && data.settings.length > 0 && (
            <div>
              <div className="font-bold text-[11px] text-teal-700 dark:text-teal-400">
                🌍 世界観・設定 ({data.settings.length}件)
              </div>
              <div className="mt-1 space-y-1 border-teal-200 border-l-2 pl-1.5 dark:border-teal-800">
                {data.settings.map((s, i: number) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {s.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {" "}
                      ({s.category})
                    </span>
                    {s.description && (
                      <p className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                        {s.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(data.foreshadowings) &&
            data.foreshadowings.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-amber-700 dark:text-amber-400">
                  🔍 伏線 ({data.foreshadowings.length}件)
                </div>
              </div>
            )}
          {Array.isArray(data.timelines) && data.timelines.length > 0 && (
            <div>
              <div className="font-bold text-[11px] text-blue-700 dark:text-blue-400">
                ⏳ 年表イベント ({data.timelines.length}件)
              </div>
              <div className="mt-1 space-y-1 border-blue-200 border-l-2 pl-1.5 dark:border-blue-800">
                {data.timelines.map((t, i: number) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t.event}
                    </span>
                    {t.timestamp && (
                      <span className="text-[10px] text-slate-500">
                        {" "}
                        ({t.timestamp})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {proposalType === "character" && (
        <div className="space-y-1">
          {data.oldCharacterName && (
            <div className="rounded border border-rose-200 bg-rose-50/80 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              🗑️ 削除対象の旧人物:{" "}
              <span className="font-bold line-through">
                {data.oldCharacterName}
              </span>{" "}
              （反映時に自動削除されます）
            </div>
          )}
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {data.name}{" "}
            <span className="font-normal text-[11px] text-slate-500">
              ({data.category})
            </span>
          </div>
          {Array.isArray(data.traits) && data.traits.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {data.traits.map((t: string, i: number) => (
                <span
                  key={i}
                  className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
            {data.description}
          </p>
        </div>
      )}

      {proposalType === "setting" && (
        <div className="space-y-1">
          {data.oldSettingName && (
            <div className="rounded border border-rose-200 bg-rose-50/80 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              🗑️ 削除対象の旧設定:{" "}
              <span className="font-bold line-through">
                {data.oldSettingName}
              </span>{" "}
              （反映時に自動削除されます）
            </div>
          )}
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {data.name}{" "}
            <span className="font-normal text-[11px] text-slate-500">
              ({data.category})
            </span>
          </div>
          <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
            {data.description}
          </p>
        </div>
      )}

      {proposalType === "delete_setting" && (
        <div className="space-y-1">
          <div className="rounded border border-rose-200 bg-rose-50/80 p-2 text-rose-800 text-xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="font-bold">
              🗑️ 削除する設定: <span className="underline">{data.name}</span>
            </div>
            {data.reason && (
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                理由: {data.reason}
              </div>
            )}
            <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
              ※ 反映すると小説データおよび設定マークダウンから完全に削除されます
            </div>
          </div>
        </div>
      )}

      {proposalType === "delete_character" && (
        <div className="space-y-1">
          <div className="rounded border border-rose-200 bg-rose-50/80 p-2 text-rose-800 text-xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="font-bold">
              🗑️ 削除する人物: <span className="underline">{data.name}</span>
            </div>
            {data.reason && (
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                理由: {data.reason}
              </div>
            )}
            <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
              ※
              反映すると小説データおよび登場人物マークダウンから完全に削除されます
            </div>
          </div>
        </div>
      )}

      {proposalType === "foreshadowing" && (
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {data.title}{" "}
            <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {data.status || "未回収"}
            </span>
          </div>
          <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
            {data.description}
          </p>
        </div>
      )}

      {proposalType === "timeline" && (
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {data.event}
          </div>
          {data.timestamp && (
            <div className="text-[11px] text-slate-500">
              時期: {data.timestamp}
            </div>
          )}
        </div>
      )}

      {proposalType === "plot" && (
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {data.chapterTitle || data.title}
          </div>
          <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
            {data.summary}
          </p>
        </div>
      )}

      {proposalType === "story_outline" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
              <span>📝 {safeSectionName}</span>
              {data.mode && data.mode !== "replace" && (
                <span className="rounded bg-amber-100 px-1.5 py-0.2 font-medium text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {data.mode === "append"
                    ? "追記"
                    : data.mode === "prepend"
                      ? "先頭挿入"
                      : "全体置換"}
                </span>
              )}
            </div>
            {data.reason && (
              <span
                className="max-w-40 truncate text-[10px] text-slate-500"
                title={data.reason}
              >
                {data.reason}
              </span>
            )}
          </div>
          {data.content?.trim() ? (
            <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50/90 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              {data.content}
            </div>
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️
              反映する本文が空です。AIに「具体的な構想本文も含めて再提案して」とお伝えください。
            </div>
          )}
        </div>
      )}
      {!targetNovelId && (
        <div className="rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️
          反映先の小説が選択されていません。チャット上部の「対象」から小説を選択してください。
        </div>
      )}
    </div>
  );
}
