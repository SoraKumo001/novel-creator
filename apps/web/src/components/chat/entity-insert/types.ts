import type {
  Character,
  ExtractedCharacterItem,
  ExtractedSettingItem,
  Setting,
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
