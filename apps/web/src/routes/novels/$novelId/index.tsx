import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { NovelExportData } from '@novel-creator/shared';
import { Button } from '@/components/Button.js';
import { ExportModal } from '@/components/ExportModal.js';
import { Loading } from '@/components/Loading.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { useChatUI } from '@/context/ChatContext.js';
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

/**
 * タブ定義（単一の情報源）。
 * タブID・表示順・ラベル・アイコン・ショートカット番号はすべてここから導出する
 * （validateSearch のバリデーション・タブ一覧の描画・本文コンテンツの描画）。
 * 表示順がそのまま Alt+N ショートカットの番号に対応する。
 */
const TAB_DEFS = [
  { id: 'overview', label: '概要', icon: '📋', shortcut: '1' },
  { id: 'characters', label: '人物', icon: '👥', shortcut: '2' },
  { id: 'settings', label: '設定', icon: '🌍', shortcut: '3' },
  { id: 'foreshadowing', label: '伏線', icon: '🚩', shortcut: '4' },
  { id: 'timeline', label: 'タイムライン', icon: '⏱️', shortcut: '5' },
  { id: 'plot', label: 'プロット', icon: '🗺️', shortcut: '6' },
  { id: 'editor', label: '本文', icon: '✍️', shortcut: '7' },
] as const;

type TabId = (typeof TAB_DEFS)[number]['id'];

/** タブID一覧（validateSearch のバリデーションに使用） */
const TAB_IDS: readonly TabId[] = TAB_DEFS.map((t) => t.id);

/** タブ本文コンテンツ（id → コンポーネント。描画はこのマップから導出する） */
const TAB_CONTENT: Record<
  TabId,
  ComponentType<{
    novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
    onRefresh: () => Promise<void>;
  }>
> = {
  overview: OverviewTab,
  characters: CharactersTab,
  settings: SettingsTab,
  foreshadowing: ForeshadowingTab,
  timeline: TimelineTab,
  plot: PlotTab,
  editor: EditorTab,
};

/** 本文コンテンツをスクロールラッパーで包むタブ */
const SCROLLABLE_TABS: ReadonlySet<TabId> = new Set<TabId>([
  'overview',
  'plot',
  'timeline',
  'foreshadowing',
]);

export const Route = createFileRoute('/novels/$novelId/')({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: (TAB_IDS.includes(search.tab as TabId) ? search.tab : undefined) as TabId | undefined,
    }) as { tab?: TabId },
  component: NovelDetailPage,
});

function NovelDetailPage() {
  const { novelId } = Route.useParams();
  const { novel, loading, error, refetch } = useNovel(novelId);
  const { tab } = Route.useSearch();
  const activeTab: TabId = tab ?? 'overview';
  const navigate = useNavigate();
  const { toggleChat } = useChatUI();
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

  // グローバルショートカット: Alt+1 ~ Alt+{TAB_DEFS.length}（現在 7）でタブ切り替え、Ctrl+J でチャット開閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+J または Cmd+J でチャット開閉
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleChat();
        return;
      }

      // Alt+1 ~ Alt+{TAB_DEFS.length} でタブ切り替え（TAB_DEFS の表示順がそのまま番号）
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= TAB_DEFS.length) {
          e.preventDefault();
          const targetTab = TAB_DEFS[num - 1].id;
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
  }, [navigate, novelId, toggleChat]);

  // 描画するタブ本文コンテンツとスクロールラッパーの要否（TAB_CONTENT / SCROLLABLE_TABS から導出）
  const ActiveTabContent = TAB_CONTENT[activeTab];
  const isScrollable = SCROLLABLE_TABS.has(activeTab);

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
              {TAB_DEFS.map((t) => {
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
            {isScrollable ? (
              <div className="h-full overflow-y-auto pr-1">
                <ActiveTabContent novel={novel} onRefresh={refetch} />
              </div>
            ) : (
              <ActiveTabContent novel={novel} onRefresh={refetch} />
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
