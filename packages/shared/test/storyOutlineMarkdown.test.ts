import { describe, expect, it } from 'vitest';
import {
  applyStoryOutlineSectionUpdate,
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

  describe('applyStoryOutlineSectionUpdate', () => {
    it('既存セクション（完全一致）を正しく置換できること', () => {
      const result = applyStoryOutlineSectionUpdate(
        sampleMarkdown,
        '結（結末）',
        '少年が古代兵器を暴走させ、帝国を滅ぼして自ら魔王となるビターエンド。',
      );
      expect(result.isNewSection).toBe(false);
      expect(result.appliedSection).toBe('結（結末）');
      expect(result.updatedMarkdown).toContain('帝国を滅ぼして自ら魔王となるビターエンド。');
      expect(result.updatedMarkdown).not.toContain('新時代の英雄となる。');
      expect(result.updatedMarkdown).toContain('# 作品コンセプト');
    });

    it('セクション名の正規化・あいまい一致で置換できること', () => {
      const result = applyStoryOutlineSectionUpdate(
        sampleMarkdown,
        '結末',
        '新たな結末テキストです。',
      );
      expect(result.isNewSection).toBe(false);
      expect(result.appliedSection).toBe('結（結末）');
      expect(result.updatedMarkdown).toContain('新たな結末テキストです。');
    });

    it('append モードで既存セクション末尾に追記できること', () => {
      const result = applyStoryOutlineSectionUpdate(
        sampleMarkdown,
        '起（序盤・導入）',
        '- 追加イベント: 幼馴染との別れ',
        'append',
      );
      expect(result.isNewSection).toBe(false);
      expect(result.updatedMarkdown).toContain('少年が魔法適性ゼロと判定され、追放される。');
      expect(result.updatedMarkdown).toContain('- 追加イベント: 幼馴染との別れ');
    });

    it('存在しないセクションの場合は新セクションとして末尾に追記されること', () => {
      const result = applyStoryOutlineSectionUpdate(
        sampleMarkdown,
        '今後の展開候補 & 分岐アイデア',
        '- 案1: 帝国との全面戦争\n- 案2: 魔境の最奥へ探索',
      );
      expect(result.isNewSection).toBe(true);
      expect(result.updatedMarkdown).toContain('## 今後の展開候補 & 分岐アイデア');
      expect(result.updatedMarkdown).toContain('案1: 帝国との全面戦争');
    });

    it('full_document または "全体" 指定でドキュメント全体が置換されること', () => {
      const result = applyStoryOutlineSectionUpdate(
        sampleMarkdown,
        'ドキュメント全体',
        '# 新しい全編構想\nすべて一新された構成',
        'full_document',
      );
      expect(result.mode).toBe('full_document');
      expect(result.updatedMarkdown).toBe('# 新しい全編構想\nすべて一新された構成');
    });

    it('空のマークダウンに対しても新規セクションとして作成できること', () => {
      const result = applyStoryOutlineSectionUpdate('', '全体あらすじ', '最初にあらすじを記入');
      expect(result.isNewSection).toBe(true);
      expect(result.updatedMarkdown).toContain('## 全体あらすじ\n最初にあらすじを記入');
    });
  });
});
