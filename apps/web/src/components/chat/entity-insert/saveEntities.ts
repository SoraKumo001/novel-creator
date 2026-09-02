import {
  parseCharactersMarkdown,
  parseForeshadowingsMarkdown,
  parsePlotMarkdown,
  parseSettingsMarkdown,
  parseTimelinesMarkdown,
  serializeCharactersToMarkdown,
  serializeForeshadowingsToMarkdown,
  serializePlotToMarkdown,
  serializeSettingsToMarkdown,
  serializeTimelinesToMarkdown,
} from "@novel-creator/shared";
import {
  fetchCharactersMarkdown,
  fetchForeshadowingsMarkdown,
  fetchPlotMarkdown,
  fetchSettingsMarkdown,
  fetchTimelinesMarkdown,
  saveCharactersMarkdown,
  saveForeshadowingsMarkdown,
  savePlotMarkdown,
  saveSettingsMarkdown,
  saveTimelinesMarkdown,
} from "@/lib/services/index.js";
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from "./types.js";

/** エンティティごとの保存結果 */
export interface SaveCounts {
  created: number;
  deleted?: number;
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

/** 選択された人物を登録・更新・置換する（overwrite / merge / replace / create） */
export async function saveCharacters(
  targetNovelId: string,
  chars: EditableCharacter[]
): Promise<SaveCounts> {
  const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
    markdown: "",
  }));
  const existingList = parseCharactersMarkdown(res.markdown ?? "");
  const map = new Map(existingList.map((c) => [c.name.trim(), c]));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const char of chars) {
    const trimmedName = char.name.trim();
    const trimmedCategory = char.category.trim() || "未分類";
    const trimmedDesc = char.description?.trim() || "";

    const traitsList: string[] = Array.isArray(char.traits)
      ? char.traits.filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0
        )
      : (char.traitsString || "")
          .split(/[,、，]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

    if (
      char.action === "replace" &&
      (char.replaceTargetName || char.matchedExisting?.name)
    ) {
      const delName = (
        char.replaceTargetName ||
        char.matchedExisting?.name ||
        ""
      ).trim();
      if (delName && map.has(delName)) {
        map.delete(delName);
        deleted++;
      }
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
        relationships: "",
        traits: traitsList,
      });
      created++;
    } else if (char.action === "overwrite" && char.matchedExisting) {
      const prev = map.get(char.matchedExisting.name.trim());
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
        relationships: prev?.relationships ?? "",
        traits: traitsList,
      });
      updated++;
    } else if (char.action === "merge" && char.matchedExisting) {
      const prev = map.get(char.matchedExisting.name.trim());
      const oldDesc = prev?.description || "";
      const mergedDesc = appendNote(oldDesc, trimmedDesc);
      const oldTraits = prev?.traits ?? [];
      const mergedTraits = Array.from(new Set([...oldTraits, ...traitsList]));

      map.set(trimmedName, {
        category: trimmedCategory,
        description: mergedDesc,
        name: trimmedName,
        relationships: prev?.relationships ?? "",
        traits: mergedTraits,
      });
      updated++;
    } else {
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
        relationships: "",
        traits: traitsList,
      });
      created++;
    }
  }

  const updatedMd = serializeCharactersToMarkdown(Array.from(map.values()));
  const result = await saveCharactersMarkdown(targetNovelId, updatedMd);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("novel-creator:characters-updated", {
        detail: {
          novelId: targetNovelId,
          markdown: updatedMd,
          appliedTitle: "チャットから取り込み（人物）",
        },
      })
    );
  }

  return {
    created: result.created ?? created,
    deleted: result.deleted ?? deleted,
    updated: result.updated ?? updated,
  };
}

/** 選択された設定を登録・更新・置換する（overwrite / merge / replace / create） */
export async function saveSettings(
  targetNovelId: string,
  sets: EditableSetting[]
): Promise<SaveCounts> {
  const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
    markdown: "",
  }));
  const existingList = parseSettingsMarkdown(res.markdown ?? "");
  const map = new Map(existingList.map((s) => [s.name.trim(), s]));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const set of sets) {
    const trimmedName = set.name.trim();
    const trimmedCategory = set.category.trim() || "世界観";
    const trimmedDesc = set.description?.trim() || "";

    if (
      set.action === "replace" &&
      (set.replaceTargetName || set.matchedExisting?.name)
    ) {
      const delName = (
        set.replaceTargetName ||
        set.matchedExisting?.name ||
        ""
      ).trim();
      if (delName && map.has(delName)) {
        map.delete(delName);
        deleted++;
      }
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
      });
      created++;
    } else if (set.action === "overwrite" && set.matchedExisting) {
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
      });
      updated++;
    } else if (set.action === "merge" && set.matchedExisting) {
      const prev = map.get(set.matchedExisting.name.trim());
      const oldDesc = prev?.description || "";
      const mergedDesc = appendNote(oldDesc, trimmedDesc);

      map.set(trimmedName, {
        category: trimmedCategory,
        description: mergedDesc,
        name: trimmedName,
      });
      updated++;
    } else {
      map.set(trimmedName, {
        category: trimmedCategory,
        description: trimmedDesc,
        name: trimmedName,
      });
      created++;
    }
  }

  const updatedMd = serializeSettingsToMarkdown(Array.from(map.values()));
  const result = await saveSettingsMarkdown(targetNovelId, updatedMd);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("novel-creator:settings-updated", {
        detail: {
          novelId: targetNovelId,
          markdown: updatedMd,
          appliedTitle: "チャットから取り込み（設定）",
        },
      })
    );
  }

  return {
    created: result.created ?? created,
    deleted: result.deleted ?? deleted,
    updated: result.updated ?? updated,
  };
}

/** 選択された伏線を登録・更新する（overwrite / merge / create） */
export async function saveForeshadowings(
  targetNovelId: string,
  fores: EditableForeshadowing[]
): Promise<SaveCounts> {
  const currentMd = await fetchForeshadowingsMarkdown(targetNovelId).catch(
    () => ""
  );
  const existingList = parseForeshadowingsMarkdown(currentMd);
  const map = new Map(existingList.map((f) => [f.title.trim(), f]));

  let created = 0;
  let updated = 0;

  for (const f of fores) {
    const trimmedTitle = f.title.trim();
    const trimmedCategory = f.category?.trim() || "未分類";
    const trimmedDesc = f.description?.trim() || "";

    if (f.action === "overwrite" && f.matchedExisting) {
      const prev = map.get(f.matchedExisting.title.trim());
      map.set(trimmedTitle, {
        category: trimmedCategory,
        description: trimmedDesc,
        placedSectionId: prev?.placedSectionId ?? null,
        resolvedSectionId: prev?.resolvedSectionId ?? null,
        status: f.status,
        title: trimmedTitle,
      });
      updated++;
    } else if (f.action === "merge" && f.matchedExisting) {
      const prev = map.get(f.matchedExisting.title.trim());
      const oldDesc = prev?.description || "";
      const mergedDesc = appendNote(oldDesc, trimmedDesc);
      map.set(trimmedTitle, {
        category: trimmedCategory,
        description: mergedDesc,
        placedSectionId: prev?.placedSectionId ?? null,
        resolvedSectionId: prev?.resolvedSectionId ?? null,
        status: f.status,
        title: trimmedTitle,
      });
      updated++;
    } else {
      map.set(trimmedTitle, {
        category: trimmedCategory,
        description: trimmedDesc,
        placedSectionId: null,
        resolvedSectionId: null,
        status: f.status,
        title: trimmedTitle,
      });
      created++;
    }
  }

  const updatedMd = serializeForeshadowingsToMarkdown(Array.from(map.values()));
  const result = await saveForeshadowingsMarkdown(targetNovelId, updatedMd);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("novel-creator:foreshadowings-updated", {
        detail: {
          novelId: targetNovelId,
          markdown: updatedMd,
          appliedTitle: "チャットから取り込み（伏線）",
        },
      })
    );
  }

  return {
    created: result.created ?? created,
    deleted: result.deleted ?? 0,
    updated: result.updated ?? updated,
  };
}

/** 選択された年表を登録・更新する（merge なし: overwrite / create のみ） */
export async function saveTimelines(
  targetNovelId: string,
  times: EditableTimeline[]
): Promise<SaveCounts> {
  const res = await fetchTimelinesMarkdown(targetNovelId).catch(() => ({
    markdown: "",
  }));
  const existingList = parseTimelinesMarkdown(res.markdown ?? "");
  const map = new Map(existingList.map((t) => [t.event.trim(), t]));

  let created = 0;
  let updated = 0;
  let maxOrder = 0;
  for (const t of existingList) {
    if (t.order > maxOrder) {
      maxOrder = t.order;
    }
  }

  for (const t of times) {
    const trimmedEvent = t.event.trim();
    const trimmedTimestamp = t.timestamp?.trim() || null;

    if (t.action === "overwrite" && t.matchedExisting) {
      const prev = map.get(t.matchedExisting.event.trim());
      map.set(trimmedEvent, {
        category: trimmedTimestamp || prev?.category || "年表",
        description: prev?.description ?? "",
        event: trimmedEvent,
        order: prev?.order ?? ++maxOrder,
        sectionId: prev?.sectionId ?? null,
        timestamp: trimmedTimestamp,
      });
      updated++;
    } else {
      map.set(trimmedEvent, {
        category: trimmedTimestamp || "年表",
        description: "",
        event: trimmedEvent,
        order: ++maxOrder,
        sectionId: null,
        timestamp: trimmedTimestamp,
      });
      created++;
    }
  }

  const updatedMd = serializeTimelinesToMarkdown(Array.from(map.values()));
  const result = await saveTimelinesMarkdown(targetNovelId, updatedMd);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("novel-creator:timelines-updated", {
        detail: {
          novelId: targetNovelId,
          markdown: updatedMd,
          appliedTitle: "チャットから取り込み（年表）",
        },
      })
    );
  }

  return {
    created: result.created ?? created,
    deleted: result.deleted ?? 0,
    updated: result.updated ?? updated,
  };
}

/** 選択されたプロット（章）を登録・更新する（overwrite / merge / create） */
export async function savePlots(
  targetNovelId: string,
  plots: EditablePlot[]
): Promise<SaveCounts> {
  const res = await fetchPlotMarkdown(targetNovelId).catch(() => ({
    markdown: "",
  }));
  const existingList = parsePlotMarkdown(res.markdown ?? "");
  const map = new Map(existingList.map((p) => [p.title.trim(), p]));

  let created = 0;
  let updated = 0;
  let maxOrder = 0;
  for (const p of existingList) {
    if (p.order > maxOrder) {
      maxOrder = p.order;
    }
  }

  for (const p of plots) {
    const trimmedTitle = p.title.trim();
    const trimmedSummary = p.summary?.trim() || "";

    if (p.action === "overwrite" && p.matchedExisting) {
      const prev = map.get(p.matchedExisting.title.trim());
      map.set(trimmedTitle, {
        order: prev?.order ?? ++maxOrder,
        sections: prev?.sections ?? [],
        summary: trimmedSummary,
        title: trimmedTitle,
      });
      updated++;
    } else if (p.action === "merge" && p.matchedExisting) {
      const prev = map.get(p.matchedExisting.title.trim());
      const oldSummary = prev?.summary || "";
      const mergedSummary = appendNote(oldSummary, trimmedSummary);
      map.set(trimmedTitle, {
        order: prev?.order ?? ++maxOrder,
        sections: prev?.sections ?? [],
        summary: mergedSummary,
        title: trimmedTitle,
      });
      updated++;
    } else {
      map.set(trimmedTitle, {
        order: ++maxOrder,
        sections: [],
        summary: trimmedSummary,
        title: trimmedTitle,
      });
      created++;
    }
  }

  const updatedMd = serializePlotToMarkdown(Array.from(map.values()));
  const result = await savePlotMarkdown(targetNovelId, updatedMd);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("novel-creator:plot-updated", {
        detail: {
          novelId: targetNovelId,
          markdown: updatedMd,
          appliedTitle: "チャットから取り込み（プロット）",
        },
      })
    );
  }

  return {
    created: result.created ?? created,
    deleted: result.deleted ?? 0,
    updated: result.updated ?? updated,
  };
}
