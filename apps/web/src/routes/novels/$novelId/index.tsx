import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { NovelExportData } from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { ExportModal } from '@/components/ExportModal.js';
import { Loading } from '@/components/Loading.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { useChat } from '@/hooks/useChat.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { fetchNovelExportData } from '@/lib/services/index.js';
import { CharactersTab } from '../_components/-CharactersTab.js';
import { EditorTab } from '../_components/-EditorTab.js';
import { OverviewTab } from '../_components/-OverviewTab.js';
import { PlotTab } from '../_components/-PlotTab.js';
import { SettingsTab } from '../_components/-SettingsTab.js';
import { TimelineTab } from '../_components/-TimelineTab.js';
import { ForeshadowingTab } from '../_components/-ForeshadowingTab.js';

export const Route = createFileRoute('/novels/$novelId/')({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: ([
        'overview',
        'settings',
        'characters',
        'plot',
        'editor',
        'timeline',
        'foreshadowing',
      ].includes(search.tab as string)
        ? search.tab
        : undefined) as TabId | undefined,
    }) as { tab?: TabId },
  component: NovelDetailPage,
});

type TabId =
  'overview' | 'settings' | 'characters' | 'plot' | 'editor' | 'timeline' | 'foreshadowing';

interface TabItem {
  id: TabId;
  label: string;
  icon: string;
  shortcut: string;
}

function NovelDetailPage() {
  const { novelId } = Route.useParams();
  const { novel, loading, error, refetch } = useNovel(novelId);
  const { tab } = Route.useSearch();
  const activeTab: TabId = tab ?? 'overview';
  const navigate = useNavigate();
  const { toggleChat } = useChat();
  const toast = useToast();

  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportData, setExportData] = useState<NovelExportData | null>(null);

  const handleOpenExport = useCallback(async () => {
    if (!novelId) return;
    setExportLoading(true);
    try {
      const data = await fetchNovelExportData(novelId);
      setExportData(data);
      setExportOpen(true);
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setExportLoading(false);
    }
  }, [novelId, toast]);

  const tabs: TabItem[] = [
    { id: 'overview', label: '概要', icon: '📋', shortcut: '1' },
    { id: 'characters', label: '人物', icon: '👥', shortcut: '2' },
    { id: 'settings', label: '設定', icon: '🌍', shortcut: '3' },
    { id: 'foreshadowing', label: '伏線', icon: '🚩', shortcut: '4' },
    { id: 'timeline', label: 'タイムライン', icon: '⏱️', shortcut: '5' },
    { id: 'plot', label: 'プロット', icon: '🗺️', shortcut: '6' },
    { id: 'editor', label: '本文', icon: '✍️', shortcut: '7' },
  ];

  // グローバルショートカット: Alt+1~6 でタブ切り替え、Ctrl+J でチャット開閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+J または Cmd+J でチャット開閉
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleChat();
        return;
      }

      // Alt+1 ~ Alt+6 でタブ切り替え
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= tabs.length) {
          e.preventDefault();
          const targetTab = tabs[num - 1].id;
          void navigate({
            to: '/novels/$novelId',
            params: { novelId },
            search: { tab: targetTab },
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, novelId, tabs, toggleChat]);

  return (
    <div className="flex h-full w-full flex-col min-h-0 overflow-hidden">
      {loading && <Loading message="小説を読み込み中..." />}
      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive shrink-0">
          {error}
        </div>
      )}
      {novel && (
        <>
          <header className="mb-4 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                小説ワークスペース
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {novel.title}
              </h1>
              {novel.description && (
                <MarkdownText
                  content={novel.description}
                  className="mt-1 max-w-4xl text-sm text-muted-foreground line-clamp-2 [&_p]:my-0"
                />
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" onClick={handleOpenExport} isLoading={exportLoading}>
                📤 全文エクスポート
              </Button>
            </div>
          </header>

          <nav className="mb-4 shrink-0 border-b border-border">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() =>
                      navigate({
                        to: '/novels/$novelId',
                        params: { novelId },
                        search: { tab: t.id },
                      })
                    }
                    className={`group flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition cursor-pointer ${
                      isActive
                        ? 'border-primary text-primary font-bold bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground hover:bg-surface-hover'
                    }`}
                    title={`Alt + ${t.shortcut}`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    <span className="hidden sm:inline-block rounded px-1 text-[10px] text-muted-foreground opacity-60 group-hover:opacity-100">
                      Alt+{t.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === 'overview' && (
              <div className="h-full overflow-y-auto pr-1">
                <OverviewTab novel={novel} onRefresh={refetch} />
              </div>
            )}
            {activeTab === 'settings' && <SettingsTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'characters' && <CharactersTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'plot' && (
              <div className="h-full overflow-y-auto pr-1">
                <PlotTab novel={novel} onRefresh={refetch} />
              </div>
            )}
            {activeTab === 'editor' && <EditorTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'timeline' && (
              <div className="h-full overflow-y-auto pr-1">
                <TimelineTab novel={novel} onRefresh={refetch} />
              </div>
            )}
            {activeTab === 'foreshadowing' && (
              <div className="h-full overflow-y-auto pr-1">
                <ForeshadowingTab novel={novel} onRefresh={refetch} />
              </div>
            )}
          </div>
        </>
      )}

      {exportData && (
        <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} novel={exportData} />
      )}
    </div>
  );
}
