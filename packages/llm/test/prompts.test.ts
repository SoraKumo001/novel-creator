import { describe, expect, it } from 'vitest';

import {
  chapterSummary,
  contentGeneration,
  editCharacter,
  editSetting,
  extractChatEntities,
  extractSettings,
  extractTimeline,
  plotGeneration,
  proofreadPrompt,
  sectionSummary,
} from '../src/prompts/index.js';

describe('plotGeneration', () => {
  it('必須フィールド（タイトル・あらすじ・章立て）が含まれること', () => {
    const prompt = plotGeneration({
      title: '星を紡ぐ者たち',
      description: '宇宙を旅する物語',
      settings: ['魔法', '宇宙'],
      characters: ['アリス', 'ボブ'],
    });
    expect(prompt).toContain('星を紡ぐ者たち');
    expect(prompt).toContain('宇宙を旅する物語');
    expect(prompt).toContain('魔法');
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"description"');
    expect(prompt).toContain('"chapters"');
  });

  it('設定・人物が空でも動作すること', () => {
    const prompt = plotGeneration({ title: 'T', description: 'D' });
    expect(prompt).toContain('T');
    expect(prompt).toContain('D');
  });
});

describe('chapterSummary', () => {
  it('小説情報と章情報のコンテキストが含まれること', () => {
    const prompt = chapterSummary(
      { title: '小説タイトル', description: '小説のあらすじ' },
      { title: '第一章', order: 1, summary: '既存の概要' },
    );
    expect(prompt).toContain('小説タイトル');
    expect(prompt).toContain('小説のあらすじ');
    expect(prompt).toContain('第一章');
    expect(prompt).toContain('既存の概要');
  });
});

describe('sectionSummary', () => {
  it('章情報と節情報のコンテキストが含まれること', () => {
    const prompt = sectionSummary(
      { title: '章タイトル', summary: '章の概要' },
      { title: '節タイトル', order: 2 },
    );
    expect(prompt).toContain('章タイトル');
    expect(prompt).toContain('章の概要');
    expect(prompt).toContain('節タイトル');
  });
});

describe('contentGeneration', () => {
  it('previousContent, characters, settings が含まれること', () => {
    const prompt = contentGeneration(
      { title: '節タイトル', summary: '節の概要' },
      {
        previousContent: '前の文脈テキスト',
        characters: ['アリス', 'ボブ'],
        settings: ['魔法世界'],
      },
    );
    expect(prompt).toContain('節タイトル');
    expect(prompt).toContain('節の概要');
    expect(prompt).toContain('前の文脈テキスト');
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('ボブ');
    expect(prompt).toContain('魔法世界');
  });
});

describe('extractTimeline', () => {
  it('JSON 出力指示が含まれること', () => {
    const prompt = extractTimeline('本文テキスト');
    expect(prompt).toContain('本文テキスト');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('"event"');
    expect(prompt).toContain('"order"');
  });
});

describe('extractSettings', () => {
  it('JSON 出力指示が含まれること', () => {
    const prompt = extractSettings('本文テキスト', ['場所: 城', '魔法: 火']);
    expect(prompt).toContain('本文テキスト');
    expect(prompt).toContain('場所: 城');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"name"');
  });
});

describe('editCharacter', () => {
  it('instruction が含まれること', () => {
    const prompt = editCharacter(
      { name: 'アリス', description: '主人公', traits: ['勇敢'] },
      'もっと大胆な性格にして',
    );
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('もっと大胆な性格にして');
  });
});

describe('editSetting', () => {
  it('instruction が含まれること', () => {
    const prompt = editSetting(
      { category: 'magic', name: '火魔法', description: '火を操る' },
      '詳細な歴史背景を追加して',
    );
    expect(prompt).toContain('火魔法');
    expect(prompt).toContain('詳細な歴史背景を追加して');
  });
});

describe('extractChatEntities', () => {
  it('チャットテキストとJSON出力形式が含まれること', () => {
    const prompt = extractChatEntities('勇者アリスと魔王の剣についての相談');
    expect(prompt).toContain('勇者アリスと魔王の剣についての相談');
    expect(prompt).toContain('"characters"');
    expect(prompt).toContain('"settings"');
    expect(prompt).toContain('"traits"');
  });
});

describe('proofreadPrompt', () => {
  it('本文およびコンテキストが含まれること', () => {
    const prompt = proofreadPrompt({
      novelTitle: 'タイトルN',
      chapterTitle: '第1章',
      sectionTitle: '第1節',
      sectionSummary: '概要S',
      characters: 'アリス',
      settings: '魔法',
      body: '本文テキストB',
    });
    expect(prompt).toContain('タイトルN');
    expect(prompt).toContain('第1章');
    expect(prompt).toContain('第1節');
    expect(prompt).toContain('概要S');
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('魔法');
    expect(prompt).toContain('本文テキストB');
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"issues"');
    expect(prompt).toContain('"polishedBody"');
  });
});
