import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Loading } from '@/components/Loading.js';
import { useNovel } from '@/hooks/useNovel.js';
import { CharactersTab } from '../_components/-CharactersTab.js';
import { EditorTab } from '../_components/-EditorTab.js';
import { OverviewTab } from '../_components/-OverviewTab.js';
import { PlotTab } from '../_components/-PlotTab.js';
import { SettingsTab } from '../_components/-SettingsTab.js';
import { TimelineTab } from '../_components/-TimelineTab.js';

export const Route = createFileRoute('/novels/$novelId/')({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: (['overview', 'settings', 'characters', 'plot', 'editor', 'timeline'].includes(
        search.tab as string,
      )
        ? search.tab
        : undefined) as TabId | undefined,
    }) as { tab?: TabId },
  component: NovelDetailPage,
});

type TabId = 'overview' | 'settings' | 'characters' | 'plot' | 'editor' | 'timeline';

function NovelDetailPage() {
  const { novelId } = Route.useParams();
  const { novel, loading, error, refetch } = useNovel(novelId);
  const { tab } = Route.useSearch();
  const activeTab: TabId = tab ?? 'overview';
  const navigate = useNavigate();

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'settings', label: '設定' },
    { id: 'characters', label: '人物' },
    { id: 'plot', label: 'プロット' },
    { id: 'editor', label: '本文' },
    { id: 'timeline', label: 'タイムライン' },
  ];

  return (
    <div className="flex h-full max-w-6xl flex-col">
      {loading && <Loading message="小説を読み込み中..." />}
      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}
      {novel && (
        <>
          <header className="mb-6 shrink-0">
            <div className="mb-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              小説詳細
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {novel.title}
            </h1>
            {novel.description && (
              <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
                {novel.description}
              </p>
            )}
          </header>
          <nav className="mb-6 shrink-0 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    navigate({
                      to: '/novels/$novelId',
                      params: { novelId },
                      search: { tab: t.id },
                    })
                  }
                  className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === t.id
                      ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="min-h-0 flex-1 overflow-auto">
            {activeTab === 'overview' && <OverviewTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'settings' && <SettingsTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'characters' && <CharactersTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'plot' && <PlotTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'editor' && <EditorTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'timeline' && <TimelineTab novel={novel} onRefresh={refetch} />}
          </div>
        </>
      )}
    </div>
  );
}
