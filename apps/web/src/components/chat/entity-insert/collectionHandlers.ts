import type { Chapter, Character, Foreshadowing, Setting, Timeline } from '@/lib/types.js';
import type {
  EditableCharacter,
  EditableForeshadowing,
  EditablePlot,
  EditableSetting,
  EditableTimeline,
} from './types.js';
import type { EntityCollection } from './useEntityCollection.js';

/**
 * チャット反映モーダルのエンティティごとの差分ロジック。
 * 共通のコレクション操作（取得・CRUD・マッチング更新）は useEntityCollection が担い、
 * ここには「手動追加の初期値」「編集時にマッチングを再計算するフィールド」
 * 「character の traitsString 二重管理」など各エンティティ固有の差分のみを置く。
 */

/** 人物: 名前変更時にマッチング更新。traitsString は traits と二重管理する */
export function createCharacterHandlers(
  collection: EntityCollection<EditableCharacter, Character>,
) {
  return {
    addEmpty: () => {
      collection.addEmptyItem(
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
    },
    update: (id: string, field: keyof EditableCharacter, value: unknown) => {
      collection.updateItem(id, (c) => {
        if (field === 'name') {
          return collection.reconcileWithExisting({ ...c, name: String(value) });
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
    },
  };
}

/** 設定: 名前変更時にマッチング更新 */
export function createSettingHandlers(collection: EntityCollection<EditableSetting, Setting>) {
  return {
    addEmpty: () => {
      collection.addEmptyItem(
        {
          name: '新しい設定',
          category: '世界観',
          description: '',
          action: 'create',
        },
        'set-',
      );
    },
    update: (id: string, field: keyof EditableSetting, value: unknown) => {
      collection.updateItem(id, (s) => {
        if (field === 'name') {
          return collection.reconcileWithExisting({ ...s, name: String(value) });
        }
        return { ...s, [field]: value };
      });
    },
  };
}

/** 伏線: タイトル変更時にマッチング更新 */
export function createForeshadowingHandlers(
  collection: EntityCollection<EditableForeshadowing, Foreshadowing>,
) {
  return {
    addEmpty: () => {
      collection.addEmptyItem(
        {
          title: '新しい伏線',
          description: '',
          status: 'unresolved',
          action: 'create',
        },
        'fore-',
      );
    },
    update: (id: string, field: keyof EditableForeshadowing, value: unknown) => {
      collection.updateItem(id, (f) => {
        if (field === 'title') {
          return collection.reconcileWithExisting({ ...f, title: String(value) });
        }
        return { ...f, [field]: value };
      });
    },
  };
}

/** 年表: 出来事変更時にマッチング更新 */
export function createTimelineHandlers(collection: EntityCollection<EditableTimeline, Timeline>) {
  return {
    addEmpty: () => {
      collection.addEmptyItem(
        {
          event: '新しい出来事',
          timestamp: '',
          action: 'create',
        },
        'time-',
      );
    },
    update: (id: string, field: keyof EditableTimeline, value: unknown) => {
      collection.updateItem(id, (t) => {
        if (field === 'event') {
          return collection.reconcileWithExisting({ ...t, event: String(value) });
        }
        return { ...t, [field]: value };
      });
    },
  };
}

/** プロット（章）: タイトル変更時にマッチング更新 */
export function createPlotHandlers(collection: EntityCollection<EditablePlot, Chapter>) {
  return {
    addEmpty: () => {
      collection.addEmptyItem(
        {
          title: '新しい章',
          summary: '',
          action: 'create',
        },
        'plot-',
      );
    },
    update: (id: string, field: keyof EditablePlot, value: unknown) => {
      collection.updateItem(id, (p) => {
        if (field === 'title') {
          return collection.reconcileWithExisting({ ...p, title: String(value) });
        }
        return { ...p, [field]: value };
      });
    },
  };
}
