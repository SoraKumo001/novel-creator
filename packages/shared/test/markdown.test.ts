import { describe, expect, it } from 'vitest';
import {
  buildCharacterTree,
  buildSettingTree,
  diffCharacters,
  diffSettings,
  findCharacterAtLine,
  findSectionAtLine,
  parseCharactersMarkdown,
  parseSettingsMarkdown,
  serializeCharactersToMarkdown,
  serializeSettingsToMarkdown,
} from '../src/index.js';

describe('settingsMarkdown', () => {
  const sampleSettings = [
    { category: '世界観', name: '魔法体系', description: '属性魔法が存在する。' },
    { category: '地理', name: '王都', description: '中央に位置する城塞都市。' },
  ];

  it('設定をマークダウンにシリアライズできること', () => {
    const md = serializeSettingsToMarkdown(sampleSettings);
    expect(md).toContain('# 世界観');
    expect(md).toContain('## 魔法体系');
    expect(md).toContain('属性魔法が存在する。');
    expect(md).toContain('# 地理');
    expect(md).toContain('## 王都');
  });

  it('マークダウンから設定をパースできること', () => {
    const md = `# 世界観\n\n## 魔法体系\n\n属性魔法が存在する。\n\n# 地理\n\n## 王都\n\n中央に位置する城塞都市。`;
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      category: '世界観',
      name: '魔法体系',
      description: '属性魔法が存在する。',
    });
    expect(parsed[1]).toEqual({
      category: '地理',
      name: '王都',
      description: '中央に位置する城塞都市。',
    });
  });

  it('コードフェンス内の見出しを無視すること', () => {
    const md = `# 世界観\n\n## 魔法体系\n\n\`\`\`markdown\n# これは見出しではない\n## これも項目ではない\n\`\`\`\n本文の続き。`;
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('魔法体系');
    expect(parsed[0].description).toContain('# これは見出しではない');
  });

  it('ツリー構造を正しく構築できること', () => {
    const md = `# 世界観\n\n## 魔法体系\n\n# 地理\n\n## 王都`;
    const tree = buildSettingTree(md);
    expect(tree).toHaveLength(2);
    expect(tree[0].category).toBe('世界観');
    expect(tree[0].children[0].name).toBe('魔法体系');
  });

  it('行番号からセクションを検索できること', () => {
    const md = `# 世界観\n\n## 魔法体系\n\n属性魔法が存在する。\n\n# 地理\n\n## 王都`;
    const found = findSectionAtLine(md, 2);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('魔法体系');
  });

  it('差分（diffSettings）が正しく計算されること', () => {
    const existing = [
      { id: '1', category: '世界観', name: '魔法体系', description: '古い説明' },
      { id: '2', category: '地理', name: '旧都市', description: '削除予定' },
    ];
    const parsed = [
      { category: '世界観', name: '魔法体系', description: '新しい説明' },
      { category: '地理', name: '王都', description: '新規都市' },
    ];
    const diff = diffSettings(existing, parsed);
    expect(diff.toCreate).toHaveLength(1);
    expect(diff.toCreate[0].name).toBe('王都');
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe('1');
    expect(diff.toUpdate[0].description).toBe('新しい説明');
    expect(diff.toDelete).toEqual(['2']);
  });
});

describe('charactersMarkdown', () => {
  const sampleCharacters = [
    {
      category: '主要人物',
      name: '主人公',
      description: '異世界から召喚された少年。',
      traits: ['勇敢', 'お人好し'],
      relationships: 'ヒロインの幼馴染。',
    },
  ];

  it('人物をマークダウンにシリアライズできること', () => {
    const md = serializeCharactersToMarkdown(sampleCharacters);
    expect(md).toContain('# 主要人物');
    expect(md).toContain('## 主人公');
    expect(md).toContain('異世界から召喚された少年。');
    expect(md).toContain('### 特徴');
    expect(md).toContain('- 勇敢');
    expect(md).toContain('- お人好し');
    expect(md).toContain('### 関係性');
    expect(md).toContain('ヒロインの幼馴染。');
  });

  it('マークダウンから人物をパースできること', () => {
    const md = `# 主要人物\n\n## 主人公\n\n異世界から召喚された少年。\n\n### 特徴\n\n- 勇敢\n- お人好し\n\n### 関係性\n\nヒロインの幼馴染。`;
    const parsed = parseCharactersMarkdown(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      category: '主要人物',
      name: '主人公',
      description: '異世界から召喚された少年。',
      traits: ['勇敢', 'お人好し'],
      relationships: 'ヒロインの幼馴染。',
    });
  });

  it('ツリー構造と行検索ができること', () => {
    const md = `# 主要人物\n\n## 主人公\n\n異世界から召喚された少年。`;
    const tree = buildCharacterTree(md);
    expect(tree).toHaveLength(1);
    expect(tree[0].category).toBe('主要人物');

    const found = findCharacterAtLine(md, 2);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('主人公');
  });

  it('差分（diffCharacters）が正しく計算されること', () => {
    const existing = [
      {
        id: '1',
        category: '主要人物',
        name: '主人公',
        description: '古い説明',
        traits: ['勇敢'],
        relationships: '',
      },
    ];
    const parsed = [
      {
        category: '主要人物',
        name: '主人公',
        description: '新しい説明',
        traits: ['勇敢', '冷静'],
        relationships: '',
      },
    ];
    const diff = diffCharacters(existing, parsed);
    expect(diff.toCreate).toHaveLength(0);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe('1');
    expect(diff.toUpdate[0].traits).toEqual(['勇敢', '冷静']);
    expect(diff.toDelete).toHaveLength(0);
  });
});
