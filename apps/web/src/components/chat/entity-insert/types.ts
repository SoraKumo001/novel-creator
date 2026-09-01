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

export type EntityAction = "create" | "overwrite" | "merge";

export interface EditableCharacter extends ExtractedCharacterItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Character;
  traitsString: string;
}

export interface EditableSetting extends ExtractedSettingItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
  matchedExisting?: Setting;
}

export interface EditableForeshadowing extends ExtractedChatForeshadowingItem {
  _id: string;
  _selected: boolean;
  action: EntityAction;
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
