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
} from "@/lib/types.js";

export type EntityAction = "create" | "overwrite" | "merge" | "replace";

export interface EditableCharacter extends ExtractedCharacterItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Character;
  replaceTargetId?: string;
  replaceTargetName?: string;
  traitsString: string;
}

export interface EditableSetting extends ExtractedSettingItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Setting;
  replaceTargetId?: string;
  replaceTargetName?: string;
}

export interface EditableForeshadowing extends ExtractedChatForeshadowingItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  category?: string;
  matchedExisting?: Foreshadowing;
}

export interface EditableTimeline extends ExtractedChatTimelineItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Timeline;
}

export interface EditablePlot extends ExtractedChatPlotItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Chapter;
}
