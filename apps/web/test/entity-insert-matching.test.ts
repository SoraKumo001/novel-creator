import {
  cleanEntityMetadata,
  normalizeEntityName,
  reconcileCharacter,
  reconcileForeshadowing,
  reconcilePlot,
  reconcileSetting,
  reconcileTimeline,
} from '../src/components/chat/entity-insert/matching.js';
import type {
  EditableCharacter,
  EditableSetting,
} from '../src/components/chat/entity-insert/types.js';
import type { Character, Setting } from '../src/lib/types.js';

describe('entity-insert matching logic', () => {
  describe('cleanEntityMetadata', () => {
    it('（既存キャラ）や（新規）などのメタ注記を除去すること', () => {
      expect(cleanEntityMetadata('ギルド長（既存キャラ）')).toBe('ギルド長');
      expect(cleanEntityMetadata('主人公 (既存キャラ)')).toBe('主人公');
      expect(cleanEntityMetadata('アイン（既存）')).toBe('アイン');
      expect(cleanEntityMetadata('護衛【新規】')).toBe('護衛');
      expect(cleanEntityMetadata('副ギルド長（既存人物）')).toBe('副ギルド長');
      expect(cleanEntityMetadata('世界観（既存設定）')).toBe('世界観');
      expect(cleanEntityMetadata('')).toBe('');
      expect(cleanEntityMetadata(null)).toBe('');
    });
  });

  describe('normalizeEntityName', () => {
    it('前後の空白、全角空白、大文字小文字を正規化し、メタ注記を除去すること', () => {
      expect(normalizeEntityName('  アイン（既存キャラ）  ')).toBe('アイン');
      expect(normalizeEntityName('アイン　フォーサイス')).toBe('アイン フォーサイス');
      expect(normalizeEntityName('Alice Forsyth (既存)')).toBe('alice forsyth');
      expect(normalizeEntityName(null)).toBe('');
    });
  });

  describe('reconcileCharacter', () => {
    const existingChars: Character[] = [
      {
        id: 'char-1',
        novelId: 'novel-1',
        name: 'アイン',
        category: '主人公',
        description: '採取ギルド所属の青年',
        traits: ['真面目'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('「（既存キャラ）」が付いた名前やカテゴリでも既存キャラと一致し、クレンジングされること', () => {
      const extracted: EditableCharacter = {
        _id: 'c0',
        _selected: true,
        name: 'アイン（既存キャラ）',
        category: '主人公（既存キャラ）',
        description: '改革を進める青年',
        traits: ['改革者'],
        traitsString: '改革者',
        action: 'create',
      };

      const result = reconcileCharacter(extracted, existingChars);
      expect(result.name).toBe('アイン');
      expect(result.category).toBe('主人公');
      expect(result.matchedExisting).toBeDefined();
      expect(result.matchedExisting?.id).toBe('char-1');
      expect(result.action).toBe('overwrite');
    });

    it('同名の既存人物が存在する場合、matchedExisting が設定され action が overwrite になること', () => {
      const extracted: EditableCharacter = {
        _id: 'c1',
        _selected: true,
        name: 'アイン',
        category: '主人公',
        description: '改革を進める青年',
        traits: ['改革者'],
        traitsString: '改革者',
        action: 'create',
      };

      const result = reconcileCharacter(extracted, existingChars);
      expect(result.matchedExisting).toBeDefined();
      expect(result.matchedExisting?.id).toBe('char-1');
      expect(result.action).toBe('overwrite');
    });

    it('空白混じりや大文字小文字違いでも一致すること', () => {
      const extracted: EditableCharacter = {
        _id: 'c2',
        _selected: true,
        name: '  アイン  ',
        category: '主人公',
        description: '',
        traits: [],
        traitsString: '',
        action: 'create',
      };

      const result = reconcileCharacter(extracted, existingChars);
      expect(result.matchedExisting?.id).toBe('char-1');
      expect(result.action).toBe('overwrite');
    });

    it('既存人物に存在しない場合は action が create のまま matchedExisting が undefined になること', () => {
      const extracted: EditableCharacter = {
        _id: 'c3',
        _selected: true,
        name: '新規キャラクター',
        category: '脇役',
        description: '',
        traits: [],
        traitsString: '',
        action: 'create',
      };

      const result = reconcileCharacter(extracted, existingChars);
      expect(result.matchedExisting).toBeUndefined();
      expect(result.action).toBe('create');
    });

    it('ユーザーが明示的に merge に設定していた場合は merge を維持すること', () => {
      const extracted: EditableCharacter = {
        _id: 'c4',
        _selected: true,
        name: 'アイン',
        category: '主人公',
        description: '追加情報',
        traits: [],
        traitsString: '',
        matchedExisting: existingChars[0],
        action: 'merge',
      };

      const result = reconcileCharacter(extracted, existingChars);
      expect(result.matchedExisting?.id).toBe('char-1');
      expect(result.action).toBe('merge');
    });
  });

  describe('reconcileSetting', () => {
    const existingSettings: Setting[] = [
      {
        id: 'set-1',
        novelId: 'novel-1',
        name: '舞台設定の基礎メモ',
        category: '世界観',
        description: '過酷な採取地帯の設定',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('同名設定が存在する場合に overwrite になること', () => {
      const extracted: EditableSetting = {
        _id: 's1',
        _selected: true,
        name: '舞台設定の基礎メモ',
        category: '世界観',
        description: '更新後の内容',
        action: 'create',
      };

      const result = reconcileSetting(extracted, existingSettings);
      expect(result.matchedExisting?.id).toBe('set-1');
      expect(result.action).toBe('overwrite');
    });
  });

  describe('reconcileForeshadowing, Timeline, Plot', () => {
    it('伏線・年表・プロットでも同様にマッチングすること', () => {
      const fores = reconcileForeshadowing(
        { _id: 'f1', _selected: true, title: '父の失踪', status: 'unresolved', action: 'create' },
        [
          {
            id: 'f-1',
            novelId: 'n1',
            title: '父の失踪',
            status: 'unresolved',
            createdAt: '',
            updatedAt: '',
          },
        ],
      );
      expect(fores.matchedExisting?.id).toBe('f-1');
      expect(fores.action).toBe('overwrite');

      const time = reconcileTimeline(
        { _id: 't1', _selected: true, event: 'ギルド入会', action: 'create' },
        [
          {
            id: 't-1',
            novelId: 'n1',
            event: 'ギルド入会',
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
      );
      expect(time.matchedExisting?.id).toBe('t-1');
      expect(time.action).toBe('overwrite');

      const plot = reconcilePlot(
        { _id: 'p1', _selected: true, title: '第1話 プロローグ', action: 'create' },
        [
          {
            id: 'c-1',
            novelId: 'n1',
            title: '第1話 プロローグ',
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
      );
      expect(plot.matchedExisting?.id).toBe('c-1');
      expect(plot.action).toBe('overwrite');
    });
  });
});
