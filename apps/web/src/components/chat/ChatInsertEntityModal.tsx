import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { novelKeys } from '@/lib/queryKeys.js';
import { Button } from '@/components/Button.js';
import { Modal } from '@/components/Modal.js';
import {
  createChapter,
  createCharacter,
  createForeshadowing,
  createSetting,
  createTimeline,
  extractChatEntities,
  fetchChapters,
  fetchCharacters,
  fetchForeshadowings,
  fetchSettings,
  fetchTimelines,
  updateChapter,
  updateCharacter,
  updateForeshadowing,
  updateSetting,
  updateTimeline,
} from '@/lib/services/index.js';
import { useToast } from '@/hooks/useToast.js';
import { useEditableEntities } from '@/hooks/useEditableEntities.js';
import type { Chapter, Character, Foreshadowing, Novel, Setting, Timeline } from '@/lib/types.js';
import { ChatInsertCharacterTab } from './entity-insert/ChatInsertCharacterTab.js';
import { ChatInsertSettingTab } from './entity-insert/ChatInsertSettingTab.js';
import { ChatInsertForeshadowingTab } from './entity-insert/ChatInsertForeshadowingTab.js';
import { ChatInsertTimelineTab } from './entity-insert/ChatInsertTimelineTab.js';
import { ChatInsertPlotTab } from './entity-insert/ChatInsertPlotTab.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
  EntityAction,
} from './entity-insert/types.js';

export type {
  EditableCharacter,
  EditableSetting,
  EditableForeshadowing,
  EditableTimeline,
  EditablePlot,
  EntityAction,
};

type ActiveTab = 'characters' | 'settings' | 'foreshadowings' | 'timelines' | 'plots';

interface ChatInsertEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceText: string;
  defaultNovelId: string | null;
  novels: Novel[];
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

  const [targetNovelId, setTargetNovelId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('characters');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [existingCharacters, setExistingCharacters] = useState<Character[]>([]);
  const [existingSettings, setExistingSettings] = useState<Setting[]>([]);
  const [existingForeshadowings, setExistingForeshadowings] = useState<Foreshadowing[]>([]);
  const [existingTimelines, setExistingTimelines] = useState<Timeline[]>([]);
  const [existingChapters, setExistingChapters] = useState<Chapter[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const {
    items: extractedCharacters,
    setItems: setExtractedCharacters,
    toggleItem: toggleCharacter,
    updateItem: updateCharacterItem,
    removeItem: removeCharacter,
    addEmptyItem: addEmptyCharacter,
  } = useEditableEntities<EditableCharacter>([]);

  const {
    items: extractedSettings,
    setItems: setExtractedSettings,
    toggleItem: toggleSetting,
    updateItem: updateSettingItem,
    removeItem: removeSetting,
    addEmptyItem: addEmptySetting,
  } = useEditableEntities<EditableSetting>([]);

  const {
    items: extractedForeshadowings,
    setItems: setExtractedForeshadowings,
    toggleItem: toggleForeshadowing,
    updateItem: updateForeshadowingItem,
    removeItem: removeForeshadowing,
    addEmptyItem: addEmptyForeshadowing,
  } = useEditableEntities<EditableForeshadowing>([]);

  const {
    items: extractedTimelines,
    setItems: setExtractedTimelines,
    toggleItem: toggleTimeline,
    updateItem: updateTimelineItem,
    removeItem: removeTimeline,
    addEmptyItem: addEmptyTimeline,
  } = useEditableEntities<EditableTimeline>([]);

  const {
    items: extractedPlots,
    setItems: setExtractedPlots,
    toggleItem: togglePlot,
    updateItem: updatePlotItem,
    removeItem: removePlot,
    addEmptyItem: addEmptyPlot,
  } = useEditableEntities<EditablePlot>([]);

  // 初期化・小説選択
  useEffect(() => {
    if (!isOpen) return;

    if (defaultNovelId) {
      setTargetNovelId(defaultNovelId);
    } else if (novels.length > 0) {
      setTargetNovelId(novels[0].id);
    } else {
      setTargetNovelId('');
    }
  }, [isOpen, defaultNovelId, novels]);

  // 選択中小説の既存データを取得
  const charactersQuery = useQuery({
    queryKey: novelKeys.characters(targetNovelId),
    queryFn: () => fetchCharacters(targetNovelId),
    enabled: !!isOpen && !!targetNovelId,
  });

  const settingsQuery = useQuery({
    queryKey: novelKeys.settings(targetNovelId),
    queryFn: () => fetchSettings(targetNovelId),
    enabled: !!isOpen && !!targetNovelId,
  });

  const foreshadowingsQuery = useQuery({
    queryKey: novelKeys.foreshadowings(targetNovelId),
    queryFn: () => fetchForeshadowings(targetNovelId),
    enabled: !!isOpen && !!targetNovelId,
  });

  const timelinesQuery = useQuery({
    queryKey: novelKeys.timelines(targetNovelId),
    queryFn: () => fetchTimelines(targetNovelId),
    enabled: !!isOpen && !!targetNovelId,
  });

  const chaptersQuery = useQuery({
    queryKey: novelKeys.chapters(targetNovelId),
    queryFn: () => fetchChapters(targetNovelId),
    enabled: !!isOpen && !!targetNovelId,
  });

  // 取得データをローカル状態へ反映
  useEffect(() => {
    if (!isOpen || !targetNovelId) {
      setExistingCharacters([]);
      setExistingSettings([]);
      setExistingForeshadowings([]);
      setExistingTimelines([]);
      setExistingChapters([]);
      return;
    }

    const isLoading =
      charactersQuery.isLoading ||
      settingsQuery.isLoading ||
      foreshadowingsQuery.isLoading ||
      timelinesQuery.isLoading ||
      chaptersQuery.isLoading;

    if (isLoading) {
      setLoadingExisting(true);
      return;
    }

    const chars = charactersQuery.data ?? [];
    const sets = settingsQuery.data ?? [];
    const fores = foreshadowingsQuery.data ?? [];
    const times = timelinesQuery.data ?? [];
    const chaps = chaptersQuery.data ?? [];

    setExistingCharacters(chars);
    setExistingSettings(sets);
    setExistingForeshadowings(fores);
    setExistingTimelines(times);
    setExistingChapters(chaps);
    setLoadingExisting(false);

    // 既存データに基づいてマッチングを更新
    setExtractedCharacters((prev) =>
      prev.map((c) => {
        const matched = chars.find(
          (ex) => ex.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
        );
        return {
          ...c,
          matchedExisting: matched,
          action: matched ? c.action || 'overwrite' : 'create',
        };
      }),
    );

    setExtractedSettings((prev) =>
      prev.map((s) => {
        const matched = sets.find(
          (ex) => ex.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
        );
        return {
          ...s,
          matchedExisting: matched,
          action: matched ? s.action || 'overwrite' : 'create',
        };
      }),
    );

    setExtractedForeshadowings((prev) =>
      prev.map((f) => {
        const matched = fores.find(
          (ex) => ex.title.trim().toLowerCase() === f.title.trim().toLowerCase(),
        );
        return {
          ...f,
          matchedExisting: matched,
          action: matched ? f.action || 'overwrite' : 'create',
        };
      }),
    );

    setExtractedTimelines((prev) =>
      prev.map((t) => {
        const matched = times.find(
          (ex) => ex.event.trim().toLowerCase() === t.event.trim().toLowerCase(),
        );
        return {
          ...t,
          matchedExisting: matched,
          action: matched ? t.action || 'overwrite' : 'create',
        };
      }),
    );

    setExtractedPlots((prev) =>
      prev.map((p) => {
        const matched = chaps.find(
          (ex) => ex.title.trim().toLowerCase() === p.title.trim().toLowerCase(),
        );
        return {
          ...p,
          matchedExisting: matched,
          action: matched ? p.action || 'overwrite' : 'create',
        };
      }),
    );
  }, [
    isOpen,
    targetNovelId,
    charactersQuery.data,
    settingsQuery.data,
    foreshadowingsQuery.data,
    timelinesQuery.data,
    chaptersQuery.data,
    charactersQuery.isLoading,
    settingsQuery.isLoading,
    foreshadowingsQuery.isLoading,
    timelinesQuery.isLoading,
    chaptersQuery.isLoading,
  ]);

  // LLM抽出処理
  useEffect(() => {
    if (!isOpen) return;

    const runExtract = async () => {
      setIsExtracting(true);
      setExtractError(null);
      try {
        const data = await extractChatEntities(sourceText);

        const chars: EditableCharacter[] = (data.characters || []).map((c, i) => {
          const matched = existingCharacters.find(
            (ex) => ex.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
          );
          return {
            ...c,
            _id: `char-${Date.now()}-${i}`,
            _selected: true,
            traitsString: Array.isArray(c.traits) ? c.traits.join(', ') : '',
            matchedExisting: matched,
            action: matched ? 'overwrite' : 'create',
          };
        });

        const sets: EditableSetting[] = (data.settings || []).map((s, i) => {
          const matched = existingSettings.find(
            (ex) => ex.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
          );
          return {
            ...s,
            _id: `set-${Date.now()}-${i}`,
            _selected: true,
            matchedExisting: matched,
            action: matched ? 'overwrite' : 'create',
          };
        });

        const fores: EditableForeshadowing[] = (data.foreshadowings || []).map((f, i) => {
          const matched = existingForeshadowings.find(
            (ex) => ex.title.trim().toLowerCase() === f.title.trim().toLowerCase(),
          );
          return {
            ...f,
            _id: `fore-${Date.now()}-${i}`,
            _selected: true,
            matchedExisting: matched,
            action: matched ? 'overwrite' : 'create',
          };
        });

        const times: EditableTimeline[] = (data.timelines || []).map((t, i) => {
          const matched = existingTimelines.find(
            (ex) => ex.event.trim().toLowerCase() === t.event.trim().toLowerCase(),
          );
          return {
            ...t,
            _id: `time-${Date.now()}-${i}`,
            _selected: true,
            matchedExisting: matched,
            action: matched ? 'overwrite' : 'create',
          };
        });

        const plots: EditablePlot[] = (data.plots || []).map((p, i) => {
          const matched = existingChapters.find(
            (ex) => ex.title.trim().toLowerCase() === p.title.trim().toLowerCase(),
          );
          return {
            ...p,
            _id: `plot-${Date.now()}-${i}`,
            _selected: true,
            matchedExisting: matched,
            action: matched ? 'overwrite' : 'create',
          };
        });

        setExtractedCharacters(chars);
        setExtractedSettings(sets);
        setExtractedForeshadowings(fores);
        setExtractedTimelines(times);
        setExtractedPlots(plots);

        // 抽出された項目があるタブを自動選択
        if (chars.length > 0) {
          setActiveTab('characters');
        } else if (sets.length > 0) {
          setActiveTab('settings');
        } else if (fores.length > 0) {
          setActiveTab('foreshadowings');
        } else if (times.length > 0) {
          setActiveTab('timelines');
        } else if (plots.length > 0) {
          setActiveTab('plots');
        } else {
          setActiveTab('characters');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'エンティティの抽出に失敗しました';
        setExtractError(msg);
      } finally {
        setIsExtracting(false);
      }
    };

    void runExtract();
  }, [isOpen, sourceText]);

  // 人物の操作ハンドラ
  const handleToggleCharacter = toggleCharacter;
  const handleRemoveCharacter = removeCharacter;
  const handleAddEmptyCharacter = () => {
    addEmptyCharacter(
      {
        name: '新しい登場人物',
        category: '未分類',
        description: '',
        traits: [],
        traitsString: '',
        action: 'create',
      },
      'char-',
    );
  };

  const handleUpdateCharacter = (id: string, field: keyof EditableCharacter, value: unknown) => {
    updateCharacterItem(id, (c) => {
      if (field === 'name') {
        const newName = String(value);
        const matched = existingCharacters.find(
          (ex) => ex.name.trim().toLowerCase() === newName.trim().toLowerCase(),
        );
        return {
          ...c,
          name: newName,
          matchedExisting: matched,
          action: matched ? c.action : 'create',
        };
      }
      if (field === 'traitsString') {
        const str = String(value);
        const traits = str
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter(Boolean);
        return { ...c, traitsString: str, traits };
      }
      return { ...c, [field]: value };
    });
  };

  // 設定の操作ハンドラ
  const handleToggleSetting = toggleSetting;
  const handleRemoveSetting = removeSetting;
  const handleAddEmptySetting = () => {
    addEmptySetting(
      {
        name: '新しい設定',
        category: '世界観',
        description: '',
        action: 'create',
      },
      'set-',
    );
  };

  const handleUpdateSetting = (id: string, field: keyof EditableSetting, value: unknown) => {
    updateSettingItem(id, (s) => {
      if (field === 'name') {
        const newName = String(value);
        const matched = existingSettings.find(
          (ex) => ex.name.trim().toLowerCase() === newName.trim().toLowerCase(),
        );
        return {
          ...s,
          name: newName,
          matchedExisting: matched,
          action: matched ? s.action : 'create',
        };
      }
      return { ...s, [field]: value };
    });
  };

  // 伏線の操作ハンドラ
  const handleToggleForeshadowing = toggleForeshadowing;
  const handleRemoveForeshadowing = removeForeshadowing;
  const handleAddEmptyForeshadowing = () => {
    addEmptyForeshadowing(
      {
        title: '新しい伏線',
        description: '',
        status: 'unresolved',
        action: 'create',
      },
      'fore-',
    );
  };

  const handleUpdateForeshadowing = (
    id: string,
    field: keyof EditableForeshadowing,
    value: unknown,
  ) => {
    updateForeshadowingItem(id, (f) => {
      if (field === 'title') {
        const newTitle = String(value);
        const matched = existingForeshadowings.find(
          (ex) => ex.title.trim().toLowerCase() === newTitle.trim().toLowerCase(),
        );
        return {
          ...f,
          title: newTitle,
          matchedExisting: matched,
          action: matched ? f.action : 'create',
        };
      }
      return { ...f, [field]: value };
    });
  };

  // タイムラインの操作ハンドラ
  const handleToggleTimeline = toggleTimeline;
  const handleRemoveTimeline = removeTimeline;
  const handleAddEmptyTimeline = () => {
    addEmptyTimeline(
      {
        event: '新しい出来事',
        timestamp: '',
        action: 'create',
      },
      'time-',
    );
  };

  const handleUpdateTimeline = (id: string, field: keyof EditableTimeline, value: unknown) => {
    updateTimelineItem(id, (t) => {
      if (field === 'event') {
        const newEvent = String(value);
        const matched = existingTimelines.find(
          (ex) => ex.event.trim().toLowerCase() === newEvent.trim().toLowerCase(),
        );
        return {
          ...t,
          event: newEvent,
          matchedExisting: matched,
          action: matched ? t.action : 'create',
        };
      }
      return { ...t, [field]: value };
    });
  };

  // プロットの操作ハンドラ
  const handleTogglePlot = togglePlot;
  const handleRemovePlot = removePlot;
  const handleAddEmptyPlot = () => {
    addEmptyPlot(
      {
        title: '新しい章',
        summary: '',
        action: 'create',
      },
      'plot-',
    );
  };

  const handleUpdatePlot = (id: string, field: keyof EditablePlot, value: unknown) => {
    updatePlotItem(id, (p) => {
      if (field === 'title') {
        const newTitle = String(value);
        const matched = existingChapters.find(
          (ex) => ex.title.trim().toLowerCase() === newTitle.trim().toLowerCase(),
        );
        return {
          ...p,
          title: newTitle,
          matchedExisting: matched,
          action: matched ? p.action : 'create',
        };
      }
      return { ...p, [field]: value };
    });
  };

  // 選択件数の集計
  const selectedChars = extractedCharacters.filter((c) => c._selected && c.name.trim());
  const selectedSets = extractedSettings.filter((s) => s._selected && s.name.trim());
  const selectedFores = extractedForeshadowings.filter((f) => f._selected && f.title.trim());
  const selectedTimes = extractedTimelines.filter((t) => t._selected && t.event.trim());
  const selectedPlots = extractedPlots.filter((p) => p._selected && p.title.trim());
  const totalSelectedCount =
    selectedChars.length +
    selectedSets.length +
    selectedFores.length +
    selectedTimes.length +
    selectedPlots.length;

  // 保存処理（新規追加・上書き・マージ対応）
  const handleSaveToNovel = async () => {
    if (!targetNovelId) {
      toast.error('登録先の小説を選択してください');
      return;
    }
    if (totalSelectedCount === 0) {
      toast.error('登録する項目を1つ以上選択してください');
      return;
    }

    setIsSaving(true);
    let createdCount = 0;
    let updatedCount = 0;

    try {
      // 1. 人物の登録・更新
      for (const char of selectedChars) {
        const trimmedName = char.name.trim();
        const trimmedCategory = char.category.trim() || '未分類';
        const trimmedDesc = char.description?.trim() || '';

        const traitsList: string[] = Array.isArray(char.traits)
          ? char.traits.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          : (char.traitsString || '')
              .split(/[,、，]/)
              .map((t) => t.trim())
              .filter((t) => t.length > 0);

        if (char.action === 'overwrite' && char.matchedExisting) {
          await updateCharacter(char.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
            traits: traitsList.length > 0 ? traitsList : undefined,
          });
          updatedCount++;
        } else if (char.action === 'merge' && char.matchedExisting) {
          const oldDesc = (char.matchedExisting.description || '').trim();
          const mergedDesc = oldDesc ? `${oldDesc}\n\n【追記】\n${trimmedDesc}` : trimmedDesc;

          const oldTraits = Array.isArray(char.matchedExisting.traits)
            ? char.matchedExisting.traits
            : [];
          const mergedTraits = Array.from(new Set([...oldTraits, ...traitsList]));

          await updateCharacter(char.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: mergedDesc || undefined,
            traits: mergedTraits.length > 0 ? mergedTraits : undefined,
          });
          updatedCount++;
        } else {
          await createCharacter(targetNovelId, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
            traits: traitsList.length > 0 ? traitsList : undefined,
          });
          createdCount++;
        }
      }

      // 2. 設定の登録・更新
      for (const set of selectedSets) {
        const trimmedName = set.name.trim();
        const trimmedCategory = set.category.trim() || '世界観';
        const trimmedDesc = set.description?.trim() || '';

        if (set.action === 'overwrite' && set.matchedExisting) {
          await updateSetting(set.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
          });
          updatedCount++;
        } else if (set.action === 'merge' && set.matchedExisting) {
          const oldDesc = (set.matchedExisting.description || '').trim();
          const mergedDesc = oldDesc ? `${oldDesc}\n\n【追記】\n${trimmedDesc}` : trimmedDesc;

          await updateSetting(set.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: mergedDesc || undefined,
          });
          updatedCount++;
        } else {
          await createSetting(targetNovelId, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
          });
          createdCount++;
        }
      }

      // 3. 伏線の登録・更新
      for (const f of selectedFores) {
        const trimmedTitle = f.title.trim();
        const trimmedDesc = f.description?.trim() || '';

        if (f.action === 'overwrite' && f.matchedExisting) {
          await updateForeshadowing(f.matchedExisting.id, {
            title: trimmedTitle,
            description: trimmedDesc || undefined,
            status: f.status,
          });
          updatedCount++;
        } else if (f.action === 'merge' && f.matchedExisting) {
          const oldDesc = (f.matchedExisting.description || '').trim();
          const mergedDesc = oldDesc ? `${oldDesc}\n\n【追記】\n${trimmedDesc}` : trimmedDesc;
          await updateForeshadowing(f.matchedExisting.id, {
            title: trimmedTitle,
            description: mergedDesc || undefined,
            status: f.status,
          });
          updatedCount++;
        } else {
          await createForeshadowing(targetNovelId, {
            title: trimmedTitle,
            description: trimmedDesc || undefined,
            status: f.status,
          });
          createdCount++;
        }
      }

      // 4. タイムラインの登録・更新
      for (const t of selectedTimes) {
        const trimmedEvent = t.event.trim();
        const trimmedTimestamp = t.timestamp?.trim() || undefined;

        if (t.action === 'overwrite' && t.matchedExisting) {
          await updateTimeline(t.matchedExisting.id, {
            event: trimmedEvent,
            timestamp: trimmedTimestamp,
          });
          updatedCount++;
        } else {
          await createTimeline(targetNovelId, {
            event: trimmedEvent,
            timestamp: trimmedTimestamp,
          });
          createdCount++;
        }
      }

      // 5. プロット（章）の登録・更新
      for (const p of selectedPlots) {
        const trimmedTitle = p.title.trim();
        const trimmedSummary = p.summary?.trim() || '';

        if (p.action === 'overwrite' && p.matchedExisting) {
          await updateChapter(p.matchedExisting.id, {
            title: trimmedTitle,
            summary: trimmedSummary || undefined,
          });
          updatedCount++;
        } else if (p.action === 'merge' && p.matchedExisting) {
          const oldSummary = (p.matchedExisting.summary || '').trim();
          const mergedSummary = oldSummary
            ? `${oldSummary}\n\n【追記】\n${trimmedSummary}`
            : trimmedSummary;
          await updateChapter(p.matchedExisting.id, {
            title: trimmedTitle,
            summary: mergedSummary || undefined,
          });
          updatedCount++;
        } else {
          await createChapter(targetNovelId, {
            title: trimmedTitle,
            summary: trimmedSummary || undefined,
          });
          createdCount++;
        }
      }

      // キャッシュの無効化
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: novelKeys.detail(targetNovelId) }),
        queryClient.invalidateQueries({ queryKey: novelKeys.characters(targetNovelId) }),
        queryClient.invalidateQueries({ queryKey: novelKeys.settings(targetNovelId) }),
        queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(targetNovelId) }),
        queryClient.invalidateQueries({ queryKey: novelKeys.timelines(targetNovelId) }),
        queryClient.invalidateQueries({ queryKey: novelKeys.chapters(targetNovelId) }),
      ]);

      const parts: string[] = [];
      if (createdCount > 0) parts.push(`新規追加: ${createdCount}件`);
      if (updatedCount > 0) parts.push(`更新・マージ: ${updatedCount}件`);

      toast.success(`小説データに反映しました（${parts.join(', ')}）`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登録中にエラーが発生しました';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📥 チャット内容を小説データに反映"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            選択中: 人物 {selectedChars.length}件 / 設定 {selectedSets.length}件 / 伏線{' '}
            {selectedFores.length}件 / 年表 {selectedTimes.length}件 / プロット{' '}
            {selectedPlots.length}件
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveToNovel}
              disabled={isSaving || isExtracting || !targetNovelId || totalSelectedCount === 0}
            >
              {isSaving ? '反映中...' : `選択した項目を登録 (${totalSelectedCount}件)`}
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
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              📚 登録先の小説:
            </label>
            <div className="flex items-center gap-3">
              <select
                id="target-novel-select"
                value={targetNovelId}
                onChange={(e) => setTargetNovelId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-850 dark:text-slate-100 sm:w-72"
              >
                {novels.length === 0 && <option value="">小説がありません</option>}
                {novels.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-slate-200/80 pt-2 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
            <span>
              登録済み: 人物 {existingCharacters.length} / 設定 {existingSettings.length} / 伏線{' '}
              {existingForeshadowings.length} / 年表 {existingTimelines.length} / 章{' '}
              {existingChapters.length}
            </span>
            {loadingExisting && <span>(データ同期中...)</span>}
          </div>
        </div>

        {/* 抽出中ローディング */}
        {isExtracting && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
            <p className="text-sm font-medium">チャットテキストから設定・プロットを解析中...</p>
            <p className="mt-1 text-xs text-slate-400">構造化データを抽出しています</p>
          </div>
        )}

        {/* 抽出エラー */}
        {extractError && !isExtracting && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
            <div className="font-bold">抽出エラー</div>
            <div>{extractError}</div>
          </div>
        )}

        {/* タブ切り替え & リスト */}
        {!isExtracting && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('characters')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === 'characters'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>👤 人物</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedCharacters.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>🌍 設定</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedSettings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('foreshadowings')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === 'foreshadowings'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>🔍 伏線</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedForeshadowings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('timelines')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === 'timelines'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>⏳ 年表</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedTimelines.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('plots')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === 'plots'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>📖 プロット</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedPlots.length}
                  </span>
                </button>
              </div>

              {activeTab === 'characters' && (
                <button
                  type="button"
                  onClick={handleAddEmptyCharacter}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 人物を手動追加
                </button>
              )}
              {activeTab === 'settings' && (
                <button
                  type="button"
                  onClick={handleAddEmptySetting}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 設定を手動追加
                </button>
              )}
              {activeTab === 'foreshadowings' && (
                <button
                  type="button"
                  onClick={handleAddEmptyForeshadowing}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 伏線を手動追加
                </button>
              )}
              {activeTab === 'timelines' && (
                <button
                  type="button"
                  onClick={handleAddEmptyTimeline}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 出来事を手動追加
                </button>
              )}
              {activeTab === 'plots' && (
                <button
                  type="button"
                  onClick={handleAddEmptyPlot}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ プロットを手動追加
                </button>
              )}
            </div>

            {/* 人物リスト */}
            {activeTab === 'characters' && (
              <ChatInsertCharacterTab
                characters={extractedCharacters}
                onToggle={handleToggleCharacter}
                onRemove={handleRemoveCharacter}
                onUpdate={handleUpdateCharacter}
              />
            )}

            {/* 設定リスト */}
            {activeTab === 'settings' && (
              <ChatInsertSettingTab
                settings={extractedSettings}
                onToggle={handleToggleSetting}
                onRemove={handleRemoveSetting}
                onUpdate={handleUpdateSetting}
              />
            )}

            {/* 伏線リスト */}
            {activeTab === 'foreshadowings' && (
              <ChatInsertForeshadowingTab
                foreshadowings={extractedForeshadowings}
                onToggle={handleToggleForeshadowing}
                onRemove={handleRemoveForeshadowing}
                onUpdate={handleUpdateForeshadowing}
              />
            )}

            {/* 年表リスト */}
            {activeTab === 'timelines' && (
              <ChatInsertTimelineTab
                timelines={extractedTimelines}
                onToggle={handleToggleTimeline}
                onRemove={handleRemoveTimeline}
                onUpdate={handleUpdateTimeline}
              />
            )}

            {/* プロットリスト */}
            {activeTab === 'plots' && (
              <ChatInsertPlotTab
                plots={extractedPlots}
                onToggle={handleTogglePlot}
                onRemove={handleRemovePlot}
                onUpdate={handleUpdatePlot}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
