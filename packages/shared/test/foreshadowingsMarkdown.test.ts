import { describe, expect, it } from 'vitest';
import {
  diffForeshadowings,
  findForeshadowingSectionByLine,
  parseForeshadowingsMarkdown,
  serializeForeshadowingsToMarkdown,
} from '../src/foreshadowingsMarkdown.js';

describe('foreshadowingsMarkdown', () => {
  const sampleForeshadowings = [
    {
      id: 'f-1',
      category: '主要伏線 / 主人公の謎',
      title: 'ペンダントの秘密',
      description: '幼少期から所持している銀のペンダント。',
      status: 'unresolved' as const,
      placedSectionId: 'sec-1',
      resolvedSectionId: null,
    },
    {
      id: 'f-2',
      category: '世界観 / 禁忌',
      title: '北の封印塔',
      description: 'かつて魔王を封じたとされる塔。',
      status: 'resolved' as const,
      placedSectionId: 'sec-2',
      resolvedSectionId: 'sec-5',
    },
  ];

  it('伏線一覧を Markdown に正しく直列化できること', () => {
    const md = serializeForeshadowingsToMarkdown(sampleForeshadowings);
    expect(md).toContain('# 主要伏線 / 主人公の謎');
    expect(md).toContain('## ペンダントの秘密');
    expect(md).toContain('<!-- status: unresolved, placed: sec-1 -->');
    expect(md).toContain('幼少期から所持している銀のペンダント。');
    expect(md).toContain('# 世界観 / 禁忌');
    expect(md).toContain('## 北の封印塔');
    expect(md).toContain('<!-- status: resolved, placed: sec-2, resolved: sec-5 -->');
  });

  it('Markdown から伏線セクションを正しくパースできること', () => {
    const md = `# 主要伏線 / 主人公の謎

## ペンダントの秘密
<!-- status: unresolved, placed: sec-1 -->
幼少期から所持している銀のペンダント。

# 世界観 / 禁忌

## 北の封印塔
<!-- status: resolved, placed: sec-2, resolved: sec-5 -->
かつて魔王を封じたとされる塔。
`;
    const parsed = parseForeshadowingsMarkdown(md);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      category: '主要伏線 / 主人公の謎',
      title: 'ペンダントの秘密',
      description: '幼少期から所持している銀のペンダント。',
      status: 'unresolved',
      placedSectionId: 'sec-1',
      resolvedSectionId: null,
    });
    expect(parsed[1]).toEqual({
      category: '世界観 / 禁忌',
      title: '北の封印塔',
      description: 'かつて魔王を封じたとされる塔。',
      status: 'resolved',
      placedSectionId: 'sec-2',
      resolvedSectionId: 'sec-5',
    });
  });

  it('行番号から伏線セクションを特定できること', () => {
    const md = `# 主要伏線

## 秘密A
<!-- status: unresolved -->
詳細A

## 秘密B
<!-- status: unresolved -->
詳細B
`;
    const secA = findForeshadowingSectionByLine(md, 3);
    expect(secA?.title).toBe('秘密A');

    const secB = findForeshadowingSectionByLine(md, 7);
    expect(secB?.title).toBe('秘密B');
  });

  it('差分検出（diffForeshadowings）が正しく機能すること', () => {
    const existing = [
      {
        id: 'f-1',
        category: '主要伏線',
        title: '秘密A',
        description: '変更前詳細',
        status: 'unresolved' as const,
        placedSectionId: null,
        resolvedSectionId: null,
      },
      {
        id: 'f-2',
        category: '主要伏線',
        title: '秘密B',
        description: '削除される予定',
        status: 'unresolved' as const,
        placedSectionId: null,
        resolvedSectionId: null,
      },
    ];

    const parsed = [
      {
        category: '主要伏線',
        title: '秘密A',
        description: '変更後詳細',
        status: 'resolved' as const,
        placedSectionId: 'sec-1',
        resolvedSectionId: 'sec-3',
      },
      {
        category: '新カテゴリ',
        title: '秘密C',
        description: '新規追加',
        status: 'unresolved' as const,
        placedSectionId: null,
        resolvedSectionId: null,
      },
    ];

    const diff = diffForeshadowings(existing, parsed);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe('f-1');
    expect(diff.toUpdate[0].description).toBe('変更後詳細');
    expect(diff.toUpdate[0].status).toBe('resolved');

    expect(diff.toCreate).toHaveLength(1);
    expect(diff.toCreate[0].title).toBe('秘密C');

    expect(diff.toDelete).toHaveLength(1);
    expect(diff.toDelete[0]).toBe('f-2');
  });
});
