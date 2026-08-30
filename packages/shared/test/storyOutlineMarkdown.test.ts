import { describe, expect, it } from 'vitest';
import {
  buildStoryOutlineCategoryTree,
  findStoryOutlineSectionByLine,
  scanStoryOutlineSectionRanges,
  STORY_OUTLINE_TEMPLATES,
} from '../src/storyOutlineMarkdown.js';

describe('storyOutlineMarkdown', () => {
  const sampleMarkdown = `# 作品コンセプト
## ログライン
魔法の使えない少年が知識で成り上がる物語

# 全体あらすじ
## あらすじ概要
魔法至上主義の帝国で、魔法ゼロの少年が古代兵器を修理して世界を救う。

# ストーリー構成
## 起（序盤・導入）
少年が魔法適性ゼロと判定され、追放される。

## 結（結末）
少年が古代兵器で魔王を封印し、新時代の英雄となる。
`;

  it('scanStoryOutlineSectionRanges でセクションと行範囲が正しく抽出されること', () => {
    const ranges = scanStoryOutlineSectionRanges(sampleMarkdown);
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges.some((r) => r.name === 'ログライン')).toBe(true);
    expect(ranges.some((r) => r.name === '起（序盤・導入）')).toBe(true);
    expect(ranges.some((r) => r.name === '結（結末）')).toBe(true);
  });

  it('findStoryOutlineSectionByLine でカーソル行のセクションを特定できること', () => {
    const lines = sampleMarkdown.split('\n');
    const introLine = lines.findIndex((l) => l.includes('少年が魔法適性ゼロと判定され'));
    const section = findStoryOutlineSectionByLine(sampleMarkdown, introLine);
    expect(section).not.toBeNull();
    expect(section?.name).toBe('起（序盤・導入）');
  });

  it('buildStoryOutlineCategoryTree でツリー構造が構築されること', () => {
    const tree = buildStoryOutlineCategoryTree(sampleMarkdown);
    expect(tree.length).toBeGreaterThan(0);
  });

  it('STORY_OUTLINE_TEMPLATES に起承転結・三幕構成などのテンプレートが存在すること', () => {
    expect(STORY_OUTLINE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(STORY_OUTLINE_TEMPLATES.some((t) => t.id === 'standard_kishotenketsu')).toBe(true);
    expect(STORY_OUTLINE_TEMPLATES.some((t) => t.id === 'three_act_structure')).toBe(true);
  });
});
