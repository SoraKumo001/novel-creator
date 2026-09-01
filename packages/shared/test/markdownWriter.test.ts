import { describe, expect, it } from 'vitest';
import {
  parseCharactersMarkdown,
  parseForeshadowingsMarkdown,
  parseSettingsMarkdown,
  serializeCharactersToMarkdown,
  serializeForeshadowingsToMarkdown,
  serializeSettingsToMarkdown,
  writeMarkdownEntitySections,
} from '../src/index.js';

/**
 * 共通 Markdown writer（writeMarkdownEntitySections）と
 * 3つの serializer（settings / characters / foreshadowings）の
 * バイト互換（serialize → parse → serialize で同一出力）を固定するテスト。
 */
describe('writeMarkdownEntitySections（共通 writer）', () => {
  it('空リストは空文字列を返すこと', () => {
    expect(
      writeMarkdownEntitySections([], {
        categoryOf: () => 'A',
        nameOf: () => 'x',
        writeBody: () => {},
      }),
    ).toBe('');
  });

  it('カテゴリ見出しの重複を避け、切り替わり直前に空行を挿入すること', () => {
    const md = writeMarkdownEntitySections(
      [
        { category: 'A', name: 'x1' },
        { category: 'A', name: 'x2' },
        { category: 'B', name: 'y1' },
      ],
      {
        categoryOf: (item) => item.category,
        nameOf: (item) => item.name,
        writeBody: () => {},
      },
    );
    // writeBody が何も書き込まない場合、本文・末尾の空行は付かない
    expect(md).toBe('# A\n\n## x1\n## x2\n\n# B\n\n## y1');
  });
});

describe('Markdown 出力のバイト互換（settings）', () => {
  it('説明の有無・空白のみの説明・末尾改行が期待どおりであること', () => {
    expect(
      serializeSettingsToMarkdown([
        { category: 'A', name: '王都', description: '中央に位置する。' },
        { category: 'A', name: '村', description: null },
        { category: 'B', name: '魔法', description: '   ' },
      ]),
    ).toBe('# A\n\n## 王都\n\n中央に位置する。\n\n## 村\n\n\n\n# B\n\n## 魔法\n');
  });

  it('空リストは空文字列であること', () => {
    expect(serializeSettingsToMarkdown([])).toBe('');
  });

  it('serialize → parse → serialize で同一出力になること', () => {
    const md = serializeSettingsToMarkdown([
      { category: '世界観', name: '魔法体系', description: '属性魔法が存在する。\n複数行の説明。' },
      { category: '地理', name: '王都', description: '中央に位置する城塞都市。' },
      { category: '地理', name: '辺境の村', description: null },
    ]);
    expect(serializeSettingsToMarkdown(parseSettingsMarkdown(md))).toBe(md);
  });
});

describe('Markdown 出力のバイト互換（characters）', () => {
  it('サブセクション（### 特徴 / ### 関係性）と空項目を含む出力が期待どおりであること', () => {
    expect(
      serializeCharactersToMarkdown([
        {
          category: 'B',
          name: '語り手',
          description: '',
          traits: [''],
          relationships: '',
        },
        {
          category: 'A',
          name: '主人公',
          description: '説明。',
          traits: ['勇敢', '  '],
          relationships: 'ヒロインの幼馴染。',
        },
      ]),
    ).toBe(
      '# A\n\n## 主人公\n\n説明。\n\n### 特徴\n\n- 勇敢\n\n### 関係性\n\nヒロインの幼馴染。\n\n\n# B\n\n## 語り手\n',
    );
  });

  it('category が null の場合は未分類になること', () => {
    expect(
      serializeCharactersToMarkdown([
        { category: null, name: 'X', description: '説明', traits: null, relationships: null },
      ]),
    ).toBe('# 未分類\n\n## X\n\n説明\n');
  });

  it('serialize → parse → serialize で同一出力になること', () => {
    const md = serializeCharactersToMarkdown([
      {
        category: '主要人物',
        name: '主人公',
        description: '異世界から召喚された少年。',
        traits: ['勇敢', 'お人好し'],
        relationships: 'ヒロインの幼馴染。',
      },
      {
        category: '主要人物',
        name: 'ヒロイン',
        description: null,
        traits: null,
        relationships: { 立場: '幼馴染' },
      },
      {
        category: '脇役',
        name: '老人',
        description: '賢者。',
        traits: [],
        relationships: '',
      },
    ]);
    expect(serializeCharactersToMarkdown(parseCharactersMarkdown(md))).toBe(md);
  });
});

describe('Markdown 出力のバイト互換（foreshadowings）', () => {
  it('メタコメント・未分類・空説明を含む出力が期待どおりであること', () => {
    expect(
      serializeForeshadowingsToMarkdown([
        {
          category: 'B',
          title: '未配置の伏線',
          description: null,
          status: null,
          placedSectionId: null,
          resolvedSectionId: null,
        },
        {
          category: 'A',
          title: 'ペンダントの秘密',
          description: '秘密。',
          status: 'resolved',
          placedSectionId: 'sec-1',
          resolvedSectionId: 'sec-2',
        },
      ]),
    ).toBe(
      '# A\n\n## ペンダントの秘密\n<!-- status: resolved, placed: sec-1, resolved: sec-2 -->\n\n秘密。\n\n\n# B\n\n## 未配置の伏線\n<!-- status: unresolved -->\n',
    );
  });

  it('serialize → parse → serialize で同一出力になること', () => {
    const md = serializeForeshadowingsToMarkdown([
      {
        category: '主要伏線 / 主人公の謎',
        title: 'ペンダントの秘密',
        description: '幼少期から所持している銀のペンダント。',
        status: 'unresolved',
        placedSectionId: 'sec-1',
        resolvedSectionId: null,
      },
      {
        category: null,
        title: '黒衣の人物',
        description: '城の地下で目撃された。',
        status: 'resolved',
        placedSectionId: null,
        resolvedSectionId: 'sec-9',
      },
    ]);
    expect(serializeForeshadowingsToMarkdown(parseForeshadowingsMarkdown(md))).toBe(md);
  });
});
