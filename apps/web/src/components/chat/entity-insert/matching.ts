import type { Chapter, Character, Foreshadowing, Setting, Timeline } from '@/lib/types.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from './types.js';

/**
 * 比較用に名前やタイトルを正規化する。
 * - 前後の空白を除去
 * - 全角・半角の連続空白を単一の半角スペースに正規化
 * - 英字は小文字化
 */
export function normalizeEntityName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/[\s\u3000]+/g, ' ')
    .toLowerCase();
}

/**
 * 既存の登場人物リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcileCharacter(
  c: EditableCharacter,
  existingList: readonly Character[],
): EditableCharacter {
  const norm = normalizeEntityName(c.name);
  if (!norm) {
    return { ...c, matchedExisting: undefined, action: 'create' };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.name) === norm);
  if (!matched) {
    return { ...c, matchedExisting: undefined, action: 'create' };
  }

  // 既存データと一致した場合:
  // 以前 matchedExisting が無かった、または以前のアクションが create だった場合は overwrite に更新
  const keepAction =
    c.matchedExisting?.id === matched.id && (c.action === 'merge' || c.action === 'overwrite');
  return {
    ...c,
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
  const norm = normalizeEntityName(s.name);
  if (!norm) {
    return { ...s, matchedExisting: undefined, action: 'create' };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.name) === norm);
  if (!matched) {
    return { ...s, matchedExisting: undefined, action: 'create' };
  }

  const keepAction =
    s.matchedExisting?.id === matched.id && (s.action === 'merge' || s.action === 'overwrite');
  return {
    ...s,
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
  const norm = normalizeEntityName(f.title);
  if (!norm) {
    return { ...f, matchedExisting: undefined, action: 'create' };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.title) === norm);
  if (!matched) {
    return { ...f, matchedExisting: undefined, action: 'create' };
  }

  const keepAction =
    f.matchedExisting?.id === matched.id && (f.action === 'merge' || f.action === 'overwrite');
  return {
    ...f,
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
  const norm = normalizeEntityName(t.event);
  if (!norm) {
    return { ...t, matchedExisting: undefined, action: 'create' };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.event) === norm);
  if (!matched) {
    return { ...t, matchedExisting: undefined, action: 'create' };
  }

  const keepAction =
    t.matchedExisting?.id === matched.id && (t.action === 'merge' || t.action === 'overwrite');
  return {
    ...t,
    matchedExisting: matched,
    action: keepAction ? t.action : 'overwrite',
  };
}

/**
 * 既存の章（プロット）リストと突き合わせ、matchedExisting と action を最新化する。
 */
export function reconcilePlot(p: EditablePlot, existingList: readonly Chapter[]): EditablePlot {
  const norm = normalizeEntityName(p.title);
  if (!norm) {
    return { ...p, matchedExisting: undefined, action: 'create' };
  }

  const matched = existingList.find((ex) => normalizeEntityName(ex.title) === norm);
  if (!matched) {
    return { ...p, matchedExisting: undefined, action: 'create' };
  }

  const keepAction =
    p.matchedExisting?.id === matched.id && (p.action === 'merge' || p.action === 'overwrite');
  return {
    ...p,
    matchedExisting: matched,
    action: keepAction ? p.action : 'overwrite',
  };
}
