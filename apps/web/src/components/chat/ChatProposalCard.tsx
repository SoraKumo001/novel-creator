import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createChapter,
  createCharacter,
  createForeshadowing,
  createSetting,
  createTimeline,
  fetchStoryOutline,
  saveStoryOutline,
} from '@/lib/services/index.js';
import { useToast } from '@/hooks/useToast.js';
import { Button } from '@/components/Button.js';

export interface ProposalPayload {
  type: 'proposal';
  proposalType: 'character' | 'setting' | 'foreshadowing' | 'timeline' | 'plot' | 'story_outline';
  novelId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  summary: string;
}

interface ChatProposalCardProps {
  proposal: ProposalPayload;
}

export function ChatProposalCard({ proposal }: ChatProposalCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [status, setStatus] = useState<'pending' | 'applied' | 'dismissed'>('pending');
  const [isApplying, setIsApplying] = useState(false);

  const { proposalType, novelId, data, summary } = proposal;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      if (proposalType === 'character') {
        await createCharacter(novelId, {
          name: data.name,
          category: data.category || '未分類',
          description: data.description,
          traits: data.traits || [],
        });
        await queryClient.invalidateQueries({ queryKey: novelKeys.characters(novelId) });
      } else if (proposalType === 'setting') {
        await createSetting(novelId, {
          name: data.name,
          category: data.category || '世界観',
          description: data.description,
        });
        await queryClient.invalidateQueries({ queryKey: novelKeys.settings(novelId) });
      } else if (proposalType === 'foreshadowing') {
        await createForeshadowing(novelId, {
          title: data.title,
          description: data.description,
          status: data.status || 'unresolved',
        });
        await queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) });
      } else if (proposalType === 'timeline') {
        await createTimeline(novelId, {
          event: data.event,
          timestamp: data.timestamp,
        });
        await queryClient.invalidateQueries({ queryKey: novelKeys.timelines(novelId) });
      } else if (proposalType === 'plot') {
        await createChapter(novelId, {
          title: data.chapterTitle || data.title,
          summary: data.summary,
        });
        await queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) });
      } else if (proposalType === 'story_outline') {
        const currentOutline = await fetchStoryOutline(novelId).catch(() => '');
        const sectionHeader = `## ${data.sectionName || '提案内容'}`;
        let updatedOutline = currentOutline.trim();
        if (updatedOutline.includes(sectionHeader)) {
          // 該当見出しが存在する場合は置換または追記
          updatedOutline = updatedOutline.replace(
            new RegExp(`(${sectionHeader}\\n)[\\s\\S]*?(?=\\n##|\\n#|$)`),
            `$1${data.content}\n`,
          );
        } else {
          updatedOutline = updatedOutline
            ? `${updatedOutline}\n\n${sectionHeader}\n${data.content}\n`
            : `${sectionHeader}\n${data.content}\n`;
        }
        await saveStoryOutline(novelId, updatedOutline);
      }

      await queryClient.invalidateQueries({ queryKey: novelKeys.detail(novelId) });
      setStatus('applied');
      toast.success(`${summary}を小説データに反映しました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '反映に失敗しました';
      toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  };

  if (status === 'dismissed') {
    return (
      <div className="my-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
        ✕ 提案をスキップしました（{summary}）
      </div>
    );
  }

  if (status === 'applied') {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
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
        <span>✔ 小説データに反映完了: {summary}</span>
      </div>
    );
  }

  const typeBadges: Record<string, { label: string; bg: string }> = {
    character: {
      label: '👤 登場人物',
      bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    },
    setting: {
      label: '🌍 世界観・設定',
      bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
    },
    foreshadowing: {
      label: '🔍 伏線',
      bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    },
    timeline: {
      label: '⏳ 年表イベント',
      bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    },
    plot: {
      label: '📖 プロット',
      bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    },
    story_outline: {
      label: '🗺️ ストーリー構想',
      bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    },
  };

  const badge = typeBadges[proposalType] || {
    label: '💡 設定提案',
    bg: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50/90 to-purple-50/40 p-3 shadow-xs dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-purple-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💡</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            設定反映の提案
          </span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.bg}`}>
            {badge.label}
          </span>
        </div>

        <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
          ワンクリックで登録可能
        </span>
      </div>

      <div className="mt-2.5 rounded-lg border border-indigo-100 bg-white/90 p-2.5 text-xs text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
        {proposalType === 'character' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.name}{' '}
              <span className="text-[11px] font-normal text-slate-500">({data.category})</span>
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
            <p className="line-clamp-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === 'setting' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.name}{' '}
              <span className="text-[11px] font-normal text-slate-500">({data.category})</span>
            </div>
            <p className="line-clamp-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === 'foreshadowing' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.title}{' '}
              <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {data.status || '未回収'}
              </span>
            </div>
            <p className="line-clamp-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === 'timeline' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">{data.event}</div>
            {data.timestamp && (
              <div className="text-[11px] text-slate-500">時期: {data.timestamp}</div>
            )}
          </div>
        )}

        {proposalType === 'plot' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.chapterTitle || data.title}
            </div>
            <p className="line-clamp-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {data.summary}
            </p>
          </div>
        )}

        {proposalType === 'story_outline' && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.sectionName || 'ストーリー構想案'}
            </div>
            <p className="line-clamp-4 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {data.content}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setStatus('dismissed')}
          disabled={isApplying}
        >
          破棄
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={handleApply}
          disabled={isApplying}
        >
          {isApplying ? '反映中...' : '✔ 小説に反映する'}
        </Button>
      </div>
    </div>
  );
}
