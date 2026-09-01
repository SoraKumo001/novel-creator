import {
  createChapter,
  createCharacter,
  createForeshadowing,
  createSetting,
  createTimeline,
  updateChapter,
  updateCharacter,
  updateForeshadowing,
  updateSetting,
  updateTimeline,
} from '@/lib/services/index.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from './types.js';

/** エンティティごとの保存結果 */
export interface SaveCounts {
  created: number;
  updated: number;
}

/**
 * merge アクション用の追記フォーマット。
 * 既存テキストがあれば「既存テキスト + 【追記】 + 新テキスト」、無ければ新テキストのみ。
 * 呼び出し元のマージ処理は既存テキストを trim して渡すため、ここでも trim して扱う。
 */
export function appendNote(existingText: string, addition: string): string {
  const trimmed = addition.trim();
  const base = existingText.trim();
  return base ? `${base}\n\n【追記】\n${trimmed}` : trimmed;
}

/** 選択された人物を登録・更新する（overwrite / merge / create） */
export async function saveCharacters(
  targetNovelId: string,
  chars: EditableCharacter[],
): Promise<SaveCounts> {
  let created = 0;
  let updated = 0;

  for (const char of chars) {
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
      updated++;
    } else if (char.action === 'merge' && char.matchedExisting) {
      const oldDesc = (char.matchedExisting.description || '').trim();
      const mergedDesc = appendNote(oldDesc, trimmedDesc);

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
      updated++;
    } else {
      await createCharacter(targetNovelId, {
        name: trimmedName,
        category: trimmedCategory,
        description: trimmedDesc || undefined,
        traits: traitsList.length > 0 ? traitsList : undefined,
      });
      created++;
    }
  }

  return { created, updated };
}

/** 選択された設定を登録・更新する（overwrite / merge / create） */
export async function saveSettings(
  targetNovelId: string,
  sets: EditableSetting[],
): Promise<SaveCounts> {
  let created = 0;
  let updated = 0;

  for (const set of sets) {
    const trimmedName = set.name.trim();
    const trimmedCategory = set.category.trim() || '世界観';
    const trimmedDesc = set.description?.trim() || '';

    if (set.action === 'overwrite' && set.matchedExisting) {
      await updateSetting(set.matchedExisting.id, {
        name: trimmedName,
        category: trimmedCategory,
        description: trimmedDesc || undefined,
      });
      updated++;
    } else if (set.action === 'merge' && set.matchedExisting) {
      const oldDesc = (set.matchedExisting.description || '').trim();
      const mergedDesc = appendNote(oldDesc, trimmedDesc);

      await updateSetting(set.matchedExisting.id, {
        name: trimmedName,
        category: trimmedCategory,
        description: mergedDesc || undefined,
      });
      updated++;
    } else {
      await createSetting(targetNovelId, {
        name: trimmedName,
        category: trimmedCategory,
        description: trimmedDesc || undefined,
      });
      created++;
    }
  }

  return { created, updated };
}

/** 選択された伏線を登録・更新する（overwrite / merge / create） */
export async function saveForeshadowings(
  targetNovelId: string,
  fores: EditableForeshadowing[],
): Promise<SaveCounts> {
  let created = 0;
  let updated = 0;

  for (const f of fores) {
    const trimmedTitle = f.title.trim();
    const trimmedDesc = f.description?.trim() || '';

    if (f.action === 'overwrite' && f.matchedExisting) {
      await updateForeshadowing(f.matchedExisting.id, {
        title: trimmedTitle,
        description: trimmedDesc || undefined,
        status: f.status,
      });
      updated++;
    } else if (f.action === 'merge' && f.matchedExisting) {
      const oldDesc = (f.matchedExisting.description || '').trim();
      const mergedDesc = appendNote(oldDesc, trimmedDesc);
      await updateForeshadowing(f.matchedExisting.id, {
        title: trimmedTitle,
        description: mergedDesc || undefined,
        status: f.status,
      });
      updated++;
    } else {
      await createForeshadowing(targetNovelId, {
        title: trimmedTitle,
        description: trimmedDesc || undefined,
        status: f.status,
      });
      created++;
    }
  }

  return { created, updated };
}

/** 選択された年表を登録・更新する（merge なし: overwrite / create のみ） */
export async function saveTimelines(
  targetNovelId: string,
  times: EditableTimeline[],
): Promise<SaveCounts> {
  let created = 0;
  let updated = 0;

  for (const t of times) {
    const trimmedEvent = t.event.trim();
    const trimmedTimestamp = t.timestamp?.trim() || undefined;

    if (t.action === 'overwrite' && t.matchedExisting) {
      await updateTimeline(t.matchedExisting.id, {
        event: trimmedEvent,
        timestamp: trimmedTimestamp,
      });
      updated++;
    } else {
      await createTimeline(targetNovelId, {
        event: trimmedEvent,
        timestamp: trimmedTimestamp,
      });
      created++;
    }
  }

  return { created, updated };
}

/** 選択されたプロット（章）を登録・更新する（overwrite / merge / create） */
export async function savePlots(targetNovelId: string, plots: EditablePlot[]): Promise<SaveCounts> {
  let created = 0;
  let updated = 0;

  for (const p of plots) {
    const trimmedTitle = p.title.trim();
    const trimmedSummary = p.summary?.trim() || '';

    if (p.action === 'overwrite' && p.matchedExisting) {
      await updateChapter(p.matchedExisting.id, {
        title: trimmedTitle,
        summary: trimmedSummary || undefined,
      });
      updated++;
    } else if (p.action === 'merge' && p.matchedExisting) {
      const oldSummary = (p.matchedExisting.summary || '').trim();
      const mergedSummary = appendNote(oldSummary, trimmedSummary);
      await updateChapter(p.matchedExisting.id, {
        title: trimmedTitle,
        summary: mergedSummary || undefined,
      });
      updated++;
    } else {
      await createChapter(targetNovelId, {
        title: trimmedTitle,
        summary: trimmedSummary || undefined,
      });
      created++;
    }
  }

  return { created, updated };
}
