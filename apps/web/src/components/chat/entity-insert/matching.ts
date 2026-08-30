import type { Chapter, Character, Foreshadowing, Setting, Timeline } from '@/lib/types.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from './types.js';

const META_LABEL_PATTERN =
  /[（(【][\s\u3000]*(?:既存|新規|既存キャラ|新規キャラ|既存設定|新規設定|既存情報|新規案|既存人物|新規人物)[\s\u3000]*[）)】]/gi;

/**
 * 名前やカテゴリ、タイトルから不要なメタ情報注記（「（既存キャラ）」「(新規)」等）を除去する。
 */
export function cleanEntityMetadata(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(META_LABEL_PATTERN, '').trim();
}

/**
 * 比較用に名前やタイトルを正規化する。
 * - メタ注記の除去
 * - 前後の空白を除去
 * - 全角・半角の連続空白を単一の半角スペースに正規化
 * - 英字は小文字化
 */
export function normalizeEntityName(name: string | null | undefined): string {
  const cleaned = cleanEntityMetadata(name);
  if (!cleaned) return '';
  return cleaned.replace(/[\s\u3000]+/g, ' ').toLowerCase();
}

/**
 * 既存の登場人物リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcileCharacter(
  c: EditableCharacter,
  existingList: readonly Character[],
): EditableCharacter {
  const cleanedName = cleanEntityMetadata(c.name);
  const cleanedCategory = cleanEntityMetadata(c.category);
  const norm = normalizeEntityName(cleanedName);

  if (!norm) {
    return {
      ...c,
      name: cleanedName,
      category: cleanedCategory,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.name) === norm);
  if (!matched) {
    return {
      ...c,
      name: cleanedName,
      category: cleanedCategory,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  // 既存データと一致した場合:
  // 以前 matchedExisting が無かった、または以前のアクションが create だった場合は overwrite に更新
  const keepAction =
    c.matchedExisting?.id === matched.id && (c.action === 'merge' || c.action === 'overwrite');
  return {
    ...c,
    name: cleanedName,
    category: cleanedCategory || matched.category || '',
    matchedExisting: matched,
    action: keepAction ? c.action : 'overwrite',
  };
}

/**
 * 既存の設定リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcileSetting(
  s: EditableSetting,
  existingList: readonly Setting[],
): EditableSetting {
  const cleanedName = cleanEntityMetadata(s.name);
  const cleanedCategory = cleanEntityMetadata(s.category);
  const norm = normalizeEntityName(cleanedName);

  if (!norm) {
    return {
      ...s,
      name: cleanedName,
      category: cleanedCategory,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.name) === norm);
  if (!matched) {
    return {
      ...s,
      name: cleanedName,
      category: cleanedCategory,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const keepAction =
    s.matchedExisting?.id === matched.id && (s.action === 'merge' || s.action === 'overwrite');
  return {
    ...s,
    name: cleanedName,
    category: cleanedCategory || matched.category || '',
    matchedExisting: matched,
    action: keepAction ? s.action : 'overwrite',
  };
}

/**
 * 既存の伏線リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcileForeshadowing(
  f: EditableForeshadowing,
  existingList: readonly Foreshadowing[],
): EditableForeshadowing {
  const cleanedTitle = cleanEntityMetadata(f.title);
  const norm = normalizeEntityName(cleanedTitle);

  if (!norm) {
    return {
      ...f,
      title: cleanedTitle,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.title) === norm);
  if (!matched) {
    return {
      ...f,
      title: cleanedTitle,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const keepAction =
    f.matchedExisting?.id === matched.id && (f.action === 'merge' || f.action === 'overwrite');
  return {
    ...f,
    title: cleanedTitle,
    matchedExisting: matched,
    action: keepAction ? f.action : 'overwrite',
  };
}

/**
 * 既存の年表リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcileTimeline(
  t: EditableTimeline,
  existingList: readonly Timeline[],
): EditableTimeline {
  const cleanedEvent = cleanEntityMetadata(t.event);
  const norm = normalizeEntityName(cleanedEvent);

  if (!norm) {
    return {
      ...t,
      event: cleanedEvent,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.event) === norm);
  if (!matched) {
    return {
      ...t,
      event: cleanedEvent,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const keepAction =
    t.matchedExisting?.id === matched.id && (t.action === 'merge' || t.action === 'overwrite');
  return {
    ...t,
    event: cleanedEvent,
    matchedExisting: matched,
    action: keepAction ? t.action : 'overwrite',
  };
}

/**
 * 既存の章（プロット）リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcilePlot(p: EditablePlot, existingList: readonly Chapter[]): EditablePlot {
  const cleanedTitle = cleanEntityMetadata(p.title);
  const norm = normalizeEntityName(cleanedTitle);

  if (!norm) {
    return {
      ...p,
      title: cleanedTitle,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.title) === norm);
  if (!matched) {
    return {
      ...p,
      title: cleanedTitle,
      matchedExisting: undefined,
      action: 'create',
    };
  }

  const keepAction =
    p.matchedExisting?.id === matched.id && (p.action === 'merge' || p.action === 'overwrite');
  return {
    ...p,
    title: cleanedTitle,
    matchedExisting: matched,
    action: keepAction ? p.action : 'overwrite',
  };
}
