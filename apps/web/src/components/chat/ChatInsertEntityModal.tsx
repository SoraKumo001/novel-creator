import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AIProgressIndicator } from "@/components/AIProgressIndicator.js";
import { Button } from "@/components/Button.js";
import { Modal } from "@/components/Modal.js";
import { useToast } from "@/hooks/useToast.js";
import { novelKeys } from "@/lib/queryKeys.js";
import {
  extractChatEntities,
  fetchChapters,
  fetchCharacters,
  fetchForeshadowings,
  fetchSettings,
  fetchTimelines,
} from "@/lib/services/index.js";
import type {
  Chapter,
  Character,
  ExtractedChatEntities,
  Foreshadowing,
  Novel,
  Setting,
  Timeline,
} from "@/lib/types.js";
import { ChatInsertCharacterTab } from "./entity-insert/ChatInsertCharacterTab.js";
import { ChatInsertForeshadowingTab } from "./entity-insert/ChatInsertForeshadowingTab.js";
import { ChatInsertPlotTab } from "./entity-insert/ChatInsertPlotTab.js";
import { ChatInsertSettingTab } from "./entity-insert/ChatInsertSettingTab.js";
import { ChatInsertTimelineTab } from "./entity-insert/ChatInsertTimelineTab.js";
import {
  createCharacterHandlers,
  createForeshadowingHandlers,
  createPlotHandlers,
  createSettingHandlers,
  createTimelineHandlers,
} from "./entity-insert/collectionHandlers.js";
import {
  reconcileCharacter,
  reconcileForeshadowing,
  reconcilePlot,
  reconcileSetting,
  reconcileTimeline,
} from "./entity-insert/matching.js";
import {
  saveCharacters,
  saveForeshadowings,
  savePlots,
  saveSettings,
  saveTimelines,
} from "./entity-insert/saveEntities.js";
import {
  toEditableCharacter,
  toEditableForeshadowing,
  toEditablePlot,
  toEditableSetting,
  toEditableTimeline,
} from "./entity-insert/toEditable.js";
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from "./entity-insert/types.js";
import { useEntityCollection } from "./entity-insert/useEntityCollection.js";

export type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
  EntityAction,
} from "./entity-insert/types.js";

type ActiveTab =
  | "characters"
  | "settings"
  | "foreshadowings"
  | "timelines"
  | "plots";

/** タブボタンの表示定義（出力される DOM は従来の個別記述と同一） */
const INSERT_TABS: { key: ActiveTab; icon: string; label: string }[] = [
  { key: "characters", icon: "👤", label: "人物" },
  { key: "settings", icon: "🌍", label: "設定" },
  { key: "foreshadowings", icon: "🔍", label: "伏線" },
  { key: "timelines", icon: "⏳", label: "年表" },
  { key: "plots", icon: "📖", label: "プロット" },
];

/** 「手動追加」ボタンのラベル定義（出力される DOM は従来の個別記述と同一） */
const ADD_BUTTON_LABELS: Record<ActiveTab, string> = {
  characters: "人物を手動追加",
  settings: "設定を手動追加",
  foreshadowings: "伏線を手動追加",
  timelines: "出来事を手動追加",
  plots: "プロットを手動追加",
};

interface ChatInsertEntityModalProps {
  defaultNovelId: string | null;
  isOpen: boolean;
  novels: Novel[];
  onClose: () => void;
  sourceText: string;
}

export function ChatInsertEntityModal({
  isOpen,
  onClose,
  sourceText,
  defaultNovelId,
  novels,
}: ChatInsertEntityModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [targetNovelId, setTargetNovelId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("characters");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const extractStartedAtRef = useRef<number>(Date.now());

  const enabled = !!isOpen && !!targetNovelId;

  // --- コレクション層: 既存データ取得 + 抽出アイテム CRUD + マッチング更新 ---
  const charactersCollection = useEntityCollection<
    EditableCharacter,
    Character
  >({
    queryKey: novelKeys.characters(targetNovelId),
    queryFn: () => fetchCharacters(targetNovelId),
    enabled,
    reconcile: reconcileCharacter,
  });

  const settingsCollection = useEntityCollection<EditableSetting, Setting>({
    queryKey: novelKeys.settings(targetNovelId),
    queryFn: () => fetchSettings(targetNovelId),
    enabled,
    reconcile: reconcileSetting,
  });

  const foreshadowingsCollection = useEntityCollection<
    EditableForeshadowing,
    Foreshadowing
  >({
    queryKey: novelKeys.foreshadowings(targetNovelId),
    queryFn: () => fetchForeshadowings(targetNovelId),
    enabled,
    reconcile: reconcileForeshadowing,
  });

  const timelinesCollection = useEntityCollection<EditableTimeline, Timeline>({
    queryKey: novelKeys.timelines(targetNovelId),
    queryFn: () => fetchTimelines(targetNovelId),
    enabled,
    reconcile: reconcileTimeline,
  });

  const plotsCollection = useEntityCollection<EditablePlot, Chapter>({
    queryKey: novelKeys.chapters(targetNovelId),
    queryFn: () => fetchChapters(targetNovelId),
    enabled,
    reconcile: reconcilePlot,
  });

  // --- エンティティごとの差分ロジック（手動追加・編集時のマッチング更新） ---
  const characterHandlers = createCharacterHandlers(charactersCollection);
  const settingHandlers = createSettingHandlers(settingsCollection);
  const foreshadowingHandlers = createForeshadowingHandlers(
    foreshadowingsCollection
  );
  const timelineHandlers = createTimelineHandlers(timelinesCollection);
  const plotHandlers = createPlotHandlers(plotsCollection);

  const loadingExisting =
    charactersCollection.loading ||
    settingsCollection.loading ||
    foreshadowingsCollection.loading ||
    timelinesCollection.loading ||
    plotsCollection.loading;

  // 初期化・小説選択
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (defaultNovelId) {
      setTargetNovelId(defaultNovelId);
    } else if (novels.length > 0) {
      setTargetNovelId(novels[0].id);
    } else {
      setTargetNovelId("");
    }
  }, [isOpen, defaultNovelId, novels]);

  // LLM 抽出結果を各コレクションへ反映する（既存データとのマッチング + タブ自動選択）。
  // 依存はすべて安定した関数のため、開閉や sourceText 変化時のみ再生成される。
  const applyExtracted = useCallback(
    (data: ExtractedChatEntities) => {
      const chars = (data.characters || []).map((c, i) =>
        charactersCollection.reconcileWithExisting(toEditableCharacter(c, i))
      );
      const sets = (data.settings || []).map((s, i) =>
        settingsCollection.reconcileWithExisting(toEditableSetting(s, i))
      );
      const fores = (data.foreshadowings || []).map((f, i) =>
        foreshadowingsCollection.reconcileWithExisting(
          toEditableForeshadowing(f, i)
        )
      );
      const times = (data.timelines || []).map((t, i) =>
        timelinesCollection.reconcileWithExisting(toEditableTimeline(t, i))
      );
      const plots = (data.plots || []).map((p, i) =>
        plotsCollection.reconcileWithExisting(toEditablePlot(p, i))
      );

      charactersCollection.setItems(chars);
      settingsCollection.setItems(sets);
      foreshadowingsCollection.setItems(fores);
      timelinesCollection.setItems(times);
      plotsCollection.setItems(plots);

      // 抽出された項目があるタブを自動選択
      if (chars.length > 0) {
        setActiveTab("characters");
      } else if (sets.length > 0) {
        setActiveTab("settings");
      } else if (fores.length > 0) {
        setActiveTab("foreshadowings");
      } else if (times.length > 0) {
        setActiveTab("timelines");
      } else if (plots.length > 0) {
        setActiveTab("plots");
      } else {
        setActiveTab("characters");
      }
    },
    [
      charactersCollection.reconcileWithExisting,
      charactersCollection.setItems,
      settingsCollection.reconcileWithExisting,
      settingsCollection.setItems,
      foreshadowingsCollection.reconcileWithExisting,
      foreshadowingsCollection.setItems,
      timelinesCollection.reconcileWithExisting,
      timelinesCollection.setItems,
      plotsCollection.reconcileWithExisting,
      plotsCollection.setItems,
    ]
  );

  // LLM抽出処理
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const runExtract = async () => {
      setIsExtracting(true);
      setExtractError(null);
      extractStartedAtRef.current = Date.now();
      try {
        const data = await extractChatEntities(sourceText);
        applyExtracted(data);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "エンティティの抽出に失敗しました";
        setExtractError(msg);
      } finally {
        setIsExtracting(false);
      }
    };

    void runExtract();
  }, [isOpen, sourceText, applyExtracted]);

  // 選択件数の集計
  const selectedChars = charactersCollection.items.filter(
    (c) => c._selected && c.name.trim()
  );
  const selectedSets = settingsCollection.items.filter(
    (s) => s._selected && s.name.trim()
  );
  const selectedFores = foreshadowingsCollection.items.filter(
    (f) => f._selected && f.title.trim()
  );
  const selectedTimes = timelinesCollection.items.filter(
    (t) => t._selected && t.event.trim()
  );
  const selectedPlots = plotsCollection.items.filter(
    (p) => p._selected && p.title.trim()
  );
  const totalSelectedCount =
    selectedChars.length +
    selectedSets.length +
    selectedFores.length +
    selectedTimes.length +
    selectedPlots.length;

  // 保存処理（新規追加・上書き・マージ対応）。
  // エンティティごとの登録・更新ロジックは entity-insert/saveEntities.ts の小関数に委譲。
  const handleSaveToNovel = async () => {
    if (!targetNovelId) {
      toast.error("登録先の小説を選択してください");
      return;
    }
    if (totalSelectedCount === 0) {
      toast.error("登録する項目を1つ以上選択してください");
      return;
    }

    setIsSaving(true);

    try {
      const charCounts = await saveCharacters(targetNovelId, selectedChars);
      const setCounts = await saveSettings(targetNovelId, selectedSets);
      const foreCounts = await saveForeshadowings(targetNovelId, selectedFores);
      const timeCounts = await saveTimelines(targetNovelId, selectedTimes);
      const plotCounts = await savePlots(targetNovelId, selectedPlots);

      const createdCount =
        charCounts.created +
        setCounts.created +
        foreCounts.created +
        timeCounts.created +
        plotCounts.created;
      const updatedCount =
        charCounts.updated +
        setCounts.updated +
        foreCounts.updated +
        timeCounts.updated +
        plotCounts.updated;
      const deletedCount = (charCounts.deleted || 0) + (setCounts.deleted || 0);

      // キャッシュの無効化
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: novelKeys.detail(targetNovelId),
        }),
        queryClient.invalidateQueries({
          queryKey: novelKeys.characters(targetNovelId),
        }),
        queryClient.invalidateQueries({
          queryKey: novelKeys.settings(targetNovelId),
        }),
        queryClient.invalidateQueries({
          queryKey: novelKeys.foreshadowings(targetNovelId),
        }),
        queryClient.invalidateQueries({
          queryKey: novelKeys.timelines(targetNovelId),
        }),
        queryClient.invalidateQueries({
          queryKey: novelKeys.chapters(targetNovelId),
        }),
      ]);

      const parts: string[] = [];
      if (createdCount > 0) {
        parts.push(`新規追加: ${createdCount}件`);
      }
      if (updatedCount > 0) {
        parts.push(`更新・マージ: ${updatedCount}件`);
      }
      if (deletedCount > 0) {
        parts.push(`旧データ削除: ${deletedCount}件`);
      }

      toast.success(`小説データに反映しました（${parts.join(", ")}）`);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "登録中にエラーが発生しました";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // タブごとの抽出件数と手動追加ハンドラ
  const countByTab: Record<ActiveTab, number> = {
    characters: charactersCollection.items.length,
    settings: settingsCollection.items.length,
    foreshadowings: foreshadowingsCollection.items.length,
    timelines: timelinesCollection.items.length,
    plots: plotsCollection.items.length,
  };
  const addEmptyByTab: Record<ActiveTab, () => void> = {
    characters: characterHandlers.addEmpty,
    settings: settingHandlers.addEmpty,
    foreshadowings: foreshadowingHandlers.addEmpty,
    timelines: timelineHandlers.addEmpty,
    plots: plotHandlers.addEmpty,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📥 チャット内容を小説データに反映"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-slate-500 text-xs dark:text-slate-400">
            選択中: 人物 {selectedChars.length}件 / 設定 {selectedSets.length}件
            / 伏線 {selectedFores.length}件 / 年表 {selectedTimes.length}件 /
            プロット {selectedPlots.length}件
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveToNovel}
              disabled={
                isSaving ||
                isExtracting ||
                !targetNovelId ||
                totalSelectedCount === 0
              }
            >
              {isSaving
                ? "反映中..."
                : `選択した項目を登録 (${totalSelectedCount}件)`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 登録先小説の選択 & 既存データステータス */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-850">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label
              htmlFor="target-novel-select"
              className="font-bold text-slate-700 text-xs dark:text-slate-300"
            >
              📚 登録先の小説:
            </label>
            <div className="flex items-center gap-3">
              <select
                id="target-novel-select"
                value={targetNovelId}
                onChange={(e) => setTargetNovelId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none sm:w-72 dark:border-slate-600 dark:bg-slate-850 dark:text-slate-100"
              >
                {novels.length === 0 && (
                  <option value="">小説がありません</option>
                )}
                {novels.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-slate-200/80 border-t pt-2 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
            <span>
              登録済み: 人物 {charactersCollection.existing.length} / 設定{" "}
              {settingsCollection.existing.length} / 伏線{" "}
              {foreshadowingsCollection.existing.length} / 年表{" "}
              {timelinesCollection.existing.length} / 章{" "}
              {plotsCollection.existing.length}
            </span>
            {loadingExisting && <span>(データ同期中...)</span>}
          </div>
        </div>

        {/* 抽出中ローディング */}
        {isExtracting && (
          <div className="rounded-xl border border-primary/30 bg-surface-raised p-4">
            <AIProgressIndicator
              stage="チャットテキストから設定・プロットを解析中..."
              description="対話ログから登場人物・世界観設定・伏線・年表・章構成の構造化データを抽出しています"
              startedAt={extractStartedAtRef.current}
              onCancel={onClose}
              cancelLabel="抽出を中止"
              variant="panel"
            />
          </div>
        )}

        {/* 抽出エラー */}
        {extractError && !isExtracting && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-xs dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
            <div className="font-bold">抽出エラー</div>
            <div>{extractError}</div>
          </div>
        )}

        {/* タブ切り替え & リスト */}
        {!isExtracting && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-slate-200 border-b pb-2 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-1.5">
                {INSERT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold text-xs transition ${
                      activeTab === tab.key
                        ? "bg-indigo-600 text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <span>
                      {tab.icon} {tab.label}
                    </span>
                    <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                      {countByTab[tab.key]}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={addEmptyByTab[activeTab]}
                className="font-medium text-indigo-600 text-xs hover:text-indigo-700 dark:text-indigo-400"
              >
                ＋ {ADD_BUTTON_LABELS[activeTab]}
              </button>
            </div>

            {/* 人物リスト */}
            {activeTab === "characters" && (
              <ChatInsertCharacterTab
                characters={charactersCollection.items}
                onToggle={charactersCollection.toggleItem}
                onRemove={charactersCollection.removeItem}
                onUpdate={characterHandlers.update}
              />
            )}

            {/* 設定リスト */}
            {activeTab === "settings" && (
              <ChatInsertSettingTab
                settings={settingsCollection.items}
                onToggle={settingsCollection.toggleItem}
                onRemove={settingsCollection.removeItem}
                onUpdate={settingHandlers.update}
              />
            )}

            {/* 伏線リスト */}
            {activeTab === "foreshadowings" && (
              <ChatInsertForeshadowingTab
                foreshadowings={foreshadowingsCollection.items}
                onToggle={foreshadowingsCollection.toggleItem}
                onRemove={foreshadowingsCollection.removeItem}
                onUpdate={foreshadowingHandlers.update}
              />
            )}

            {/* 年表リスト */}
            {activeTab === "timelines" && (
              <ChatInsertTimelineTab
                timelines={timelinesCollection.items}
                onToggle={timelinesCollection.toggleItem}
                onRemove={timelinesCollection.removeItem}
                onUpdate={timelineHandlers.update}
              />
            )}

            {/* プロットリスト */}
            {activeTab === "plots" && (
              <ChatInsertPlotTab
                plots={plotsCollection.items}
                onToggle={plotsCollection.toggleItem}
                onRemove={plotsCollection.removeItem}
                onUpdate={plotHandlers.update}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
