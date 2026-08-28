import { describe, expect, it } from 'vitest';
import { formatNovelText, type NovelExportData } from '../src/exportFormatter.js';

const mockNovel: NovelExportData = {
  title: '異世界転生記',
  description: '勇者として召喚された主人公の物語。',
  chapters: [
    {
      title: '始まりの町',
      order: 1,
      sections: [
        {
          title: '召喚の儀式',
          order: 1,
          content: 'まばゆい光とともに、私は見知らぬ祭壇に立っていた。',
        },
        {
          title: '王女の依頼',
          order: 2,
          content: '「どうか、魔王を倒してください」王女は頭を下げた。',
        },
      ],
    },
    {
      title: '旅立ちの朝',
      order: 2,
      sections: [
        {
          title: '門出',
          order: 1,
          content: '朝焼けの中、私は城門をくぐった。',
        },
      ],
    },
  ],
};

describe('exportFormatter', () => {
  it('Markdown 形式で正しく出力されること', () => {
    const output = formatNovelText(mockNovel, 'markdown');
    expect(output).toContain('# 異世界転生記');
    expect(output).toContain('勇者として召喚された主人公の物語。');
    expect(output).toContain('## 始まりの町');
    expect(output).toContain('### 召喚の儀式');
    expect(output).toContain('まばゆい光とともに、私は見知らぬ祭壇に立っていた。');
    expect(output).toContain('## 旅立ちの朝');
  });

  it('Plain text 形式で正しく出力されること', () => {
    const output = formatNovelText(mockNovel, 'plain');
    expect(output).toContain('■ 異世界転生記');
    expect(output).toContain('【始まりの町】');
    expect(output).toContain('[召喚の儀式]');
    expect(output).toContain('まばゆい光とともに、私は見知らぬ祭壇に立っていた。');
  });

  it('なろう形式で正しく出力されること', () => {
    const output = formatNovelText(mockNovel, 'narou');
    expect(output).toContain('異世界転生記');
    expect(output).toContain('第1章');
    expect(output).toContain('始まりの町');
    expect(output).toContain('召喚の儀式');
  });

  it('カクヨム形式で正しく出力されること', () => {
    const output = formatNovelText(mockNovel, 'kakuyomu');
    expect(output).toContain('異世界転生記');
    expect(output).toContain('【始まりの町】');
    expect(output).toContain('召喚の儀式');
  });
});
