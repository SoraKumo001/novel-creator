import { applyStoryOutlineSectionUpdate } from "@novel-creator/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { Button } from "@/components/Button.js";
import { ChatUIContext } from "@/context/ChatContext.js";
import { useToast } from "@/hooks/useToast.js";
import { novelKeys } from "@/lib/queryKeys.js";
import {
  createChapter,
  createCharacter,
  createForeshadowing,
  createSetting,
  createTimeline,
  fetchStoryOutline,
  saveStoryOutline,
} from "@/lib/services/index.js";

export interface ProposalPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  novelId: string;
  proposalType:
    | "bulk"
    | "character"
    | "setting"
    | "foreshadowing"
    | "timeline"
    | "plot"
    | "story_outline";
  summary: string;
  type: "proposal";
}

interface ChatProposalCardProps {
  proposal: ProposalPayload;
}

export function ChatProposalCard({ proposal }: ChatProposalCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const chatUI = useContext(ChatUIContext);

  const [status, setStatus] = useState<"pending" | "applied" | "dismissed">(
    "pending"
  );
  const [isApplying, setIsApplying] = useState(false);

  const { proposalType, data, summary } = proposal;

  const rawNovelId = proposal.novelId;
  const targetNovelId =
    typeof rawNovelId === "string" &&
    rawNovelId.trim() &&
    rawNovelId !== "undefined" &&
    rawNovelId !== "null"
      ? rawNovelId.trim()
      : chatUI?.selectedNovelId?.trim() || "";

  const rawSectionName = data.sectionName;
  const safeSectionName =
    typeof rawSectionName === "string" &&
    rawSectionName.trim() &&
    rawSectionName !== "undefined"
      ? rawSectionName.trim()
      : data.mode === "full_document"
        ? "ドキュメント全体"
        : "全体あらすじ";

  const cleanSummary =
    summary && !summary.includes("undefined")
      ? summary
      : proposalType === "story_outline"
        ? `ストーリー構想「${safeSectionName}」の更新提案${data.reason ? `（${data.reason}）` : ""}`
        : summary || "設定登録提案";

  const handleApply = async () => {
    if (!targetNovelId) {
      toast.error(
        "反映対象の小説が未選択です。上部の「対象」セレクターから小説を選択してください。"
      );
      return;
    }
    setIsApplying(true);
    try {
      if (proposalType === "bulk") {
        const characters = Array.isArray(data.characters)
          ? data.characters
          : [];
        const settings = Array.isArray(data.settings) ? data.settings : [];
        const foreshadowings = Array.isArray(data.foreshadowings)
          ? data.foreshadowings
          : [];
        const timelines = Array.isArray(data.timelines) ? data.timelines : [];

        for (const c of characters) {
          await createCharacter(targetNovelId, {
            name: c.name,
            category: c.category || "未分類",
            description: c.description,
            traits: c.traits || [],
          });
        }
        for (const s of settings) {
          await createSetting(targetNovelId, {
            name: s.name,
            category: s.category || "世界観",
            description: s.description,
          });
        }
        for (const f of foreshadowings) {
          await createForeshadowing(targetNovelId, {
            title: f.title,
            description: f.description,
            status: f.status || "unresolved",
          });
        }
        for (const t of timelines) {
          await createTimeline(targetNovelId, {
            event: t.event,
            timestamp: t.timestamp,
          });
        }

        if (characters.length > 0) {
          await queryClient.invalidateQueries({
            queryKey: novelKeys.characters(targetNovelId),
          });
        }
        if (settings.length > 0) {
          await queryClient.invalidateQueries({
            queryKey: novelKeys.settings(targetNovelId),
          });
        }
        if (foreshadowings.length > 0) {
          await queryClient.invalidateQueries({
            queryKey: novelKeys.foreshadowings(targetNovelId),
          });
        }
        if (timelines.length > 0) {
          await queryClient.invalidateQueries({
            queryKey: novelKeys.timelines(targetNovelId),
          });
        }
      } else if (proposalType === "character") {
        await createCharacter(targetNovelId, {
          name: data.name,
          category: data.category || "未分類",
          description: data.description,
          traits: data.traits || [],
        });
        await queryClient.invalidateQueries({
          queryKey: novelKeys.characters(targetNovelId),
        });
      } else if (proposalType === "setting") {
        await createSetting(targetNovelId, {
          name: data.name,
          category: data.category || "世界観",
          description: data.description,
        });
        await queryClient.invalidateQueries({
          queryKey: novelKeys.settings(targetNovelId),
        });
      } else if (proposalType === "foreshadowing") {
        await createForeshadowing(targetNovelId, {
          title: data.title,
          description: data.description,
          status: data.status || "unresolved",
        });
        await queryClient.invalidateQueries({
          queryKey: novelKeys.foreshadowings(targetNovelId),
        });
      } else if (proposalType === "timeline") {
        await createTimeline(targetNovelId, {
          event: data.event,
          timestamp: data.timestamp,
        });
        await queryClient.invalidateQueries({
          queryKey: novelKeys.timelines(targetNovelId),
        });
      } else if (proposalType === "plot") {
        await createChapter(targetNovelId, {
          title: data.chapterTitle || data.title,
          summary: data.summary,
        });
        await queryClient.invalidateQueries({
          queryKey: novelKeys.chapters(targetNovelId),
        });
      } else if (proposalType === "story_outline") {
        const currentOutline = await fetchStoryOutline(targetNovelId).catch(
          () => ""
        );
        const sectionName = safeSectionName;
        const content = data.content || "";
        const mode = data.mode || "replace";

        const { updatedMarkdown, appliedSection } =
          applyStoryOutlineSectionUpdate(
            currentOutline,
            sectionName,
            content,
            mode
          );

        await saveStoryOutline(targetNovelId, updatedMarkdown);

        // 開いているストーリー構想エディタ（Monaco Editor）へ即時反映イベントを発火
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:story-outline-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMarkdown,
                appliedSection,
                mode,
              },
            })
          );
        }
      }

      await queryClient.invalidateQueries({
        queryKey: novelKeys.detail(targetNovelId),
      });
      setStatus("applied");
      toast.success(`${cleanSummary}を小説データに反映しました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "反映に失敗しました";
      toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  };

  if (status === "dismissed") {
    return (
      <div className="my-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-slate-400 text-xs dark:border-slate-800 dark:bg-slate-900/40">
        ✕ 提案をスキップしました（{cleanSummary}）
      </div>
    );
  }

  if (status === "applied") {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-2 font-medium text-emerald-800 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        <span>✔ 小説データに反映完了: {cleanSummary}</span>
      </div>
    );
  }

  const typeBadges: Record<string, { label: string; bg: string }> = {
    bulk: {
      label: "📦 一括登録",
      bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    },
    character: {
      label: "👤 登場人物",
      bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
    },
    setting: {
      label: "🌍 世界観・設定",
      bg: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
    },
    foreshadowing: {
      label: "🔍 伏線",
      bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
    timeline: {
      label: "⏳ 年表イベント",
      bg: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    },
    plot: {
      label: "📖 プロット",
      bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    },
    story_outline: {
      label: "🗺️ ストーリー構想",
      bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
  };

  const badge = typeBadges[proposalType] || {
    label: "💡 設定提案",
    bg: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50/90 to-purple-50/40 p-3 shadow-xs dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-purple-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💡</span>
          <span className="font-bold text-slate-800 text-xs dark:text-slate-200">
            設定反映の提案
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-semibold text-[10px] ${badge.bg}`}
          >
            {badge.label}
          </span>
        </div>

        <span className="font-medium text-[11px] text-indigo-700 dark:text-indigo-400">
          ワンクリックで登録可能
        </span>
      </div>

      <div className="mt-2.5 rounded-lg border border-indigo-100 bg-white/90 p-2.5 text-slate-700 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
        {proposalType === "bulk" && (
          <div className="space-y-2">
            {Array.isArray(data.characters) && data.characters.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-indigo-700 dark:text-indigo-400">
                  👤 登場人物 ({data.characters.length}名)
                </div>
                <div className="mt-1 space-y-1 border-indigo-200 border-l-2 pl-1.5 dark:border-indigo-800">
                  {data.characters.map((c: any, i: number) => (
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
                  {data.settings.map((s: any, i: number) => (
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
                  <div className="mt-1 space-y-1 border-amber-200 border-l-2 pl-1.5 dark:border-amber-800">
                    {data.foreshadowings.map((f: any, i: number) => (
                      <div key={i} className="text-[11px]">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {f.title}
                        </span>
                        {f.description && (
                          <p className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                            {f.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {Array.isArray(data.timelines) && data.timelines.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-blue-700 dark:text-blue-400">
                  ⏳ 年表イベント ({data.timelines.length}件)
                </div>
                <div className="mt-1 space-y-1 border-blue-200 border-l-2 pl-1.5 dark:border-blue-800">
                  {data.timelines.map((t: any, i: number) => (
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
                  className="max-w-[160px] truncate text-[10px] text-slate-500"
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

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setStatus("dismissed")}
          disabled={isApplying}
        >
          破棄
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={handleApply}
          disabled={
            isApplying ||
            !targetNovelId ||
            (proposalType === "story_outline" && !data.content?.trim())
          }
        >
          {isApplying ? "反映中..." : "✔ 小説に反映する"}
        </Button>
      </div>
    </div>
  );
}
