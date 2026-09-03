import type { NovelExportData } from "@novel-creator/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/Button.js";
import { ExportModal } from "@/components/ExportModal.js";
import { Loading } from "@/components/Loading.js";
import { MarkdownText } from "@/components/MarkdownText.js";
import { useChatUI } from "@/context/ChatContext.js";
import { useNovel } from "@/hooks/useNovel.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { fetchNovelExportData } from "@/lib/services/index.js";
import { CharactersTab } from "../_components/-CharactersTab.js";
import { EditorTab } from "../_components/-EditorTab.js";
import { ForeshadowingTab } from "../_components/-ForeshadowingTab.js";
import { OverviewTab } from "../_components/-OverviewTab.js";
import { PlotTab } from "../_components/-PlotTab.js";
import { SettingsTab } from "../_components/-SettingsTab.js";
import { StoryOutlineTab } from "../_components/-StoryOutlineTab.js";
import { TimelineTab } from "../_components/-TimelineTab.js";

/**
 * タブ定義（単一の情報源）。
 * タブID・表示順・ラベル・アイコン・ショートカット番号はすべてここから導出する
 * （validateSearch のバリデーション・タブ一覧の描画・本文コンテンツの描画）。
 * 表示順がそのまま Alt+N ショートカットの番号に対応する。
 */
const TAB_DEFS = [
  { id: "overview", label: "概要", icon: "📋", shortcut: "1" },
  { id: "outline", label: "構想", icon: "🗺️", shortcut: "2" },
  { id: "characters", label: "人物", icon: "👥", shortcut: "3" },
  { id: "settings", label: "設定", icon: "🌍", shortcut: "4" },
  { id: "foreshadowing", label: "伏線", icon: "🚩", shortcut: "5" },
  { id: "timeline", label: "タイムライン", icon: "⏱️", shortcut: "6" },
  { id: "plot", label: "プロット", icon: "📑", shortcut: "7" },
  { id: "editor", label: "本文", icon: "✍️", shortcut: "8" },
] as const;

type TabId = (typeof TAB_DEFS)[number]["id"];

/** タブID一覧（validateSearch のバリデーションに使用） */
const TAB_IDS: readonly TabId[] = TAB_DEFS.map((t) => t.id);

/** タブ本文コンテンツ（id → コンポーネント。描画はこのマップから導出する） */
const TAB_CONTENT: Record<
  TabId,
  ComponentType<{
    novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
    onRefresh: () => Promise<void>;
  }>
> = {
  overview: OverviewTab,
  outline: StoryOutlineTab,
  characters: CharactersTab,
  settings: SettingsTab,
  foreshadowing: ForeshadowingTab,
  timeline: TimelineTab,
  plot: PlotTab,
  editor: EditorTab,
};

/** 本文コンテンツをスクロールラッパーで包むタブ（概要タブのみ。他は各タブ内で高さ100%管理） */
const SCROLLABLE_TABS: ReadonlySet<TabId> = new Set<TabId>(["overview"]);

export const Route = createFileRoute("/novels/$novelId/")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: (TAB_IDS.includes(search.tab as TabId) ? search.tab : undefined) as
        | TabId
        | undefined,
    }) as { tab?: TabId },
  component: NovelDetailPage,
});

function NovelDetailPage() {
  const { novelId } = Route.useParams();
  const { novel, loading, error, refetch } = useNovel(novelId);
  const { tab } = Route.useSearch();
  const activeTab: TabId = tab ?? "overview";
  const navigate = useNavigate();
  const { toggleChat } = useChatUI();
  const toast = useToast();

  const tabListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportData, setExportData] = useState<NovelExportData | null>(null);

  const checkTabScroll = useCallback(() => {
    const el = tabListRef.current;
    if (!el) {
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    checkTabScroll();
    window.addEventListener("resize", checkTabScroll);
    return () => window.removeEventListener("resize", checkTabScroll);
  }, [checkTabScroll]);

  // アクティブタブ切り替え時に可視領域へ自動スクロール
  useEffect(() => {
    const el = tabListRef.current;
    if (!el) {
      return;
    }
    const activeEl = el.querySelector(
      `[data-tab-id="${activeTab}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    checkTabScroll();
  }, [activeTab, checkTabScroll]);

  const scrollTab = (direction: "left" | "right") => {
    const el = tabListRef.current;
    if (!el) {
      return;
    }
    const amount = 200;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleOpenExport = useCallback(async () => {
    if (!novelId) {
      return;
    }
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

  // グローバルショートカット: Alt+1 ~ Alt+{TAB_DEFS.length}（現在 8）でタブ切り替え、Ctrl+J でチャット開閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+J または Cmd+J でチャット開閉
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleChat();
        return;
      }

      // Alt+1 ~ Alt+{TAB_DEFS.length} でタブ切り替え（TAB_DEFS の表示順がそのまま番号）
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= TAB_DEFS.length) {
          e.preventDefault();
          const targetTab = TAB_DEFS[num - 1].id;
          void navigate({
            to: "/novels/$novelId",
            params: { novelId },
            search: { tab: targetTab },
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, novelId, toggleChat]);

  // 描画するタブ本文コンテンツとスクロールラッパーの要否（TAB_CONTENT / SCROLLABLE_TABS から導出）
  const ActiveTabContent = TAB_CONTENT[activeTab];
  const isScrollable = SCROLLABLE_TABS.has(activeTab);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {loading && <Loading message="小説を読み込み中..." />}
      {!loading && error && (
        <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}
      {novel && (
        <>
          <header className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 font-semibold text-primary text-xs uppercase tracking-wider">
                小説ワークスペース
              </div>
              <h1 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">
                {novel.title}
              </h1>
              {novel.description && (
                <MarkdownText
                  content={novel.description}
                  className="mt-1 line-clamp-2 max-w-4xl text-muted-foreground text-sm [&_p]:my-0"
                />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleOpenExport}
                isLoading={exportLoading}
              >
                📤 全文エクスポート
              </Button>
            </div>
          </header>

          <nav className="relative mb-4 shrink-0 border-border border-b">
            {/* 左スクロール矢印ボタン */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollTab("left")}
                className="absolute top-0 bottom-0 left-0 z-10 flex cursor-pointer items-center bg-gradient-to-r from-surface via-surface/90 to-transparent pr-3 pl-1 text-muted-foreground transition hover:text-foreground"
                aria-label="左へスクロール"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}

            <div
              ref={tabListRef}
              onScroll={checkTabScroll}
              className="flex gap-1 overflow-x-auto scroll-smooth pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TAB_DEFS.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    data-tab-id={t.id}
                    onClick={() =>
                      navigate({
                        to: "/novels/$novelId",
                        params: { novelId },
                        search: { tab: t.id },
                      })
                    }
                    className={`group flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-1.5 font-medium text-xs transition sm:px-3 sm:py-2 sm:text-sm ${
                      isActive
                        ? "border-primary bg-primary/5 font-bold text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
                    }`}
                    title={`Alt + ${t.shortcut}`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    <span className="hidden rounded px-1 text-[10px] text-muted-foreground opacity-60 group-hover:opacity-100 xl:inline-block">
                      Alt+{t.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 右スクロール矢印ボタン */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollTab("right")}
                className="absolute top-0 right-0 bottom-0 z-10 flex cursor-pointer items-center bg-gradient-to-l from-surface via-surface/90 to-transparent pr-1 pl-3 text-muted-foreground transition hover:text-foreground"
                aria-label="右へスクロール"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
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
        <ExportModal
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          novel={exportData}
        />
      )}
    </div>
  );
}
