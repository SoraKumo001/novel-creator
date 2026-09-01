import type {
  ExtractedCharacterItem,
  ExtractedChatForeshadowingItem,
  ExtractedChatPlotItem,
  ExtractedChatTimelineItem,
  ExtractedSettingItem,
} from '@/lib/types.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from './types.js';

/**
 * LLM 抽出結果 1件を編集可能アイテムへ変換する純関数群。
 * _id / _selected / action の付与と、エンティティ固有の正規化
 * （character の traitsString 二重管理など）のみを担い、
 * 既存データとのマッチング（reconcile）は呼び出し側で行う。
 */

export function toEditableCharacter(raw: ExtractedCharacterItem, index: number): EditableCharacter {
  return {
    ...raw,
    _id: `char-${Date.now()}-${index}`,
    _selected: true,
    traitsString: Array.isArray(raw.traits) ? raw.traits.join(', ') : '',
    action: 'create',
  };
}

export function toEditableSetting(raw: ExtractedSettingItem, index: number): EditableSetting {
  return {
    ...raw,
    _id: `set-${Date.now()}-${index}`,
    _selected: true,
    action: 'create',
  };
}

export function toEditableForeshadowing(
  raw: ExtractedChatForeshadowingItem,
  index: number,
): EditableForeshadowing {
  return {
    ...raw,
    _id: `fore-${Date.now()}-${index}`,
    _selected: true,
    action: 'create',
  };
}

export function toEditableTimeline(
  raw: ExtractedChatTimelineItem,
  index: number,
): EditableTimeline {
  return {
    ...raw,
    _id: `time-${Date.now()}-${index}`,
    _selected: true,
    action: 'create',
  };
}

export function toEditablePlot(raw: ExtractedChatPlotItem, index: number): EditablePlot {
  return {
    ...raw,
    _id: `plot-${Date.now()}-${index}`,
    _selected: true,
    action: 'create',
  };
}
