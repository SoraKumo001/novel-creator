import type {
  Chapter,
  Character,
  ExtractedCharacterItem,
  ExtractedChatForeshadowingItem,
  ExtractedChatPlotItem,
  ExtractedChatTimelineItem,
  ExtractedSettingItem,
  Foreshadowing,
  Setting,
  Timeline,
} from '@/lib/types.js';

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

export interface EditableForeshadowing extends ExtractedChatForeshadowingItem {
  _id: string;
  _selected: boolean;
  matchedExisting?: Foreshadowing;
  action: EntityAction;
}

export interface EditableTimeline extends ExtractedChatTimelineItem {
  _id: string;
  _selected: boolean;
  matchedExisting?: Timeline;
  action: EntityAction;
}

export interface EditablePlot extends ExtractedChatPlotItem {
  _id: string;
  _selected: boolean;
  matchedExisting?: Chapter;
  action: EntityAction;
}
