import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { novelKeys } from '@/lib/queryKeys.js';
import { Button } from '@/components/Button.js';
import { Modal } from '@/components/Modal.js';
import {
  createCharacter,
  createSetting,
  extractChatEntities,
  fetchCharacters,
  fetchSettings,
  updateCharacter,
  updateSetting,
} from '@/lib/services/index.js';
import { useToast } from '@/hooks/useToast.js';
import { useEditableEntities } from '@/hooks/useEditableEntities.js';
import type {
  Character,
  ExtractedCharacterItem,
  ExtractedSettingItem,
  Novel,
  Setting,
} from '@/lib/types.js';

interface ChatInsertEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceText: string;
  defaultNovelId: string | null;
  novels: Novel[];
}

export type EntityAction = 'create' | 'overwrite' | 'merge';

export interface EditableCharacter extends ExtractedCharacterItem {
  _id: string;
  _selected: boolean;
  traitsString: string;
  matchedExisting?: Character;
  action: EntityAction;
}

export interface EditableSetting extends ExtractedSettingItem {
  _id: string;
  _selected: boolean;
  matchedExisting?: Setting;
  action: EntityAction;
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
  const [activeTab, setActiveTab] = useState<'characters' | 'settings'>('characters');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [existingCharacters, setExistingCharacters] = useState<Character[]>([]);
  const [existingSettings, setExistingSettings] = useState<Setting[]>([]);
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

  // 選択中小説の既存データを取得（共有キャッシュ経由）
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

  // 取得データをローカル状態へ反映
  useEffect(() => {
    if (!isOpen || !targetNovelId) {
      setExistingCharacters([]);
      setExistingSettings([]);
      return;
    }

    if (charactersQuery.isLoading || settingsQuery.isLoading) {
      setLoadingExisting(true);
      return;
    }

    const chars = charactersQuery.data ?? [];
    const sets = settingsQuery.data ?? [];
    setExistingCharacters(chars);
    setExistingSettings(sets);
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
  }, [
    isOpen,
    targetNovelId,
    charactersQuery.data,
    settingsQuery.data,
    charactersQuery.isLoading,
    settingsQuery.isLoading,
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

        setExtractedCharacters(chars);
        setExtractedSettings(sets);

        if (chars.length === 0 && sets.length > 0) {
          setActiveTab('settings');
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

  // 人物の操作ハンドラ（トグル・削除・追加は汎用フックをそのまま利用）
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

  // 人物の更新（名前マッチング・traits 分割はエンティティ固有ロジック）
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

  // 設定の操作ハンドラ（トグル・削除・追加は汎用フックをそのまま利用）
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

  // 設定の更新（名前マッチングはエンティティ固有ロジック）
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

  // 選択件数の集計
  const selectedChars = extractedCharacters.filter((c) => c._selected && c.name.trim());
  const selectedSets = extractedSettings.filter((s) => s._selected && s.name.trim());
  const totalSelectedCount = selectedChars.length + selectedSets.length;

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

        // traits の安全な配列化
        const traitsList: string[] = Array.isArray(char.traits)
          ? char.traits.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          : (char.traitsString || '')
              .split(/[,、，]/)
              .map((t) => t.trim())
              .filter((t) => t.length > 0);

        if (char.action === 'overwrite' && char.matchedExisting) {
          // 上書き更新
          await updateCharacter(char.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
            traits: traitsList.length > 0 ? traitsList : undefined,
          });
          updatedCount++;
        } else if (char.action === 'merge' && char.matchedExisting) {
          // 追記マージ
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
          // 新規追加 (create)
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
          // 上書き更新
          await updateSetting(set.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
          });
          updatedCount++;
        } else if (set.action === 'merge' && set.matchedExisting) {
          // 追記マージ
          const oldDesc = (set.matchedExisting.description || '').trim();
          const mergedDesc = oldDesc ? `${oldDesc}\n\n【追記】\n${trimmedDesc}` : trimmedDesc;

          await updateSetting(set.matchedExisting.id, {
            name: trimmedName,
            category: trimmedCategory,
            description: mergedDesc || undefined,
          });
          updatedCount++;
        } else {
          // 新規追加 (create)
          await createSetting(targetNovelId, {
            name: trimmedName,
            category: trimmedCategory,
            description: trimmedDesc || undefined,
          });
          createdCount++;
        }
      }

      // キャッシュの無効化（小説配下の全データを一括無効化）
      await queryClient.invalidateQueries({
        queryKey: novelKeys.detail(targetNovelId),
      });

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
            選択中: 人物 {selectedChars.length}件 / 設定 {selectedSets.length}件
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-72"
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

          <div className="mt-2 flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
            <span>
              登録済みデータ: 人物 {existingCharacters.length}件 / 設定 {existingSettings.length}件
            </span>
            {loadingExisting && <span>(データ同期中...)</span>}
          </div>
        </div>

        {/* 抽出中ローディング */}
        {isExtracting && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent mb-3" />
            <p className="text-sm font-medium">チャットテキストから人物・設定を解析中...</p>
            <p className="text-xs text-slate-400 mt-1">構造化データを抽出しています</p>
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
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('characters')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'characters'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>👤 登場人物</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedCharacters.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>🌍 世界観・設定</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {extractedSettings.length}
                  </span>
                </button>
              </div>

              {activeTab === 'characters' ? (
                <button
                  type="button"
                  onClick={handleAddEmptyCharacter}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 人物を手動追加
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddEmptySetting}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  ＋ 設定を手動追加
                </button>
              )}
            </div>

            {/* 人物リスト */}
            {activeTab === 'characters' && (
              <div className="mt-3 space-y-3">
                {extractedCharacters.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    検出された登場人物はありませんでした。「＋ 人物を手動追加」から追加できます。
                  </div>
                ) : (
                  extractedCharacters.map((char) => (
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
                            onChange={() => handleToggleCharacter(char._id)}
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
                                  onChange={(e) =>
                                    handleUpdateCharacter(
                                      char._id,
                                      'action',
                                      e.target.value as EntityAction,
                                    )
                                  }
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
                                onChange={(e) =>
                                  handleUpdateCharacter(char._id, 'name', e.target.value)
                                }
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
                                onChange={(e) =>
                                  handleUpdateCharacter(char._id, 'category', e.target.value)
                                }
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
                              onChange={(e) =>
                                handleUpdateCharacter(char._id, 'traitsString', e.target.value)
                              }
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
                              onChange={(e) =>
                                handleUpdateCharacter(char._id, 'description', e.target.value)
                              }
                              placeholder="人物の外見、性格、目的などの説明"
                              className="w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCharacter(char._id)}
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 設定リスト */}
            {activeTab === 'settings' && (
              <div className="mt-3 space-y-3">
                {extractedSettings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    検出された設定情報はありませんでした。「＋ 設定を手動追加」から追加できます。
                  </div>
                ) : (
                  extractedSettings.map((set) => (
                    <div
                      key={set._id}
                      className={`rounded-xl border p-3 transition ${
                        set._selected
                          ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-600/60 dark:bg-indigo-950/20'
                          : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            checked={set._selected}
                            onChange={() => handleToggleSetting(set._id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                          />
                        </div>

                        <div className="flex-1 space-y-2">
                          {/* 既存データとの重複判定 & アクション選択 */}
                          {set.matchedExisting ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                              <span className="font-semibold text-amber-800 dark:text-amber-300">
                                ⚠️ 既存の設定「{set.matchedExisting.name}」と名前が一致
                              </span>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-slate-600 dark:text-slate-300">
                                  反映方法:
                                </label>
                                <select
                                  value={set.action}
                                  onChange={(e) =>
                                    handleUpdateSetting(
                                      set._id,
                                      'action',
                                      e.target.value as EntityAction,
                                    )
                                  }
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
                                設定名
                              </label>
                              <input
                                type="text"
                                value={set.name}
                                onChange={(e) =>
                                  handleUpdateSetting(set._id, 'name', e.target.value)
                                }
                                placeholder="例: 神聖ルミナス帝国"
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                                カテゴリ
                              </label>
                              <input
                                type="text"
                                value={set.category}
                                onChange={(e) =>
                                  handleUpdateSetting(set._id, 'category', e.target.value)
                                }
                                placeholder="例: 世界観, 魔法, 地理"
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                              詳細説明
                            </label>
                            <textarea
                              rows={2}
                              value={set.description || ''}
                              onChange={(e) =>
                                handleUpdateSetting(set._id, 'description', e.target.value)
                              }
                              placeholder="設定の詳細内容やルールなど"
                              className="w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSetting(set._id)}
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
