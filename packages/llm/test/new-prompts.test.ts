import { describe, expect, it } from 'vitest';
import {
  analyzeSettingImpactPrompt,
  analyzeStoryArcPrompt,
  checkCharacterVoicePrompt,
  inlineAssistPrompt,
  multiPersonaReviewPrompt,
} from '../src/index.js';

describe('New Analysis and Writing LLM Prompts', () => {
  it('inlineAssistPrompt が正しくプロンプトを構築すること', () => {
    const prompt = inlineAssistPrompt({
      novelTitle: '星海の旅人',
      selectedText: '彼は走った。',
      action: 'expand',
    });
    expect(prompt).toContain('星海の旅人');
    expect(prompt).toContain('彼は走った。');
    expect(prompt).toContain('五感');
  });

  it('checkCharacterVoicePrompt が正しくプロンプトを構築すること', () => {
    const prompt = checkCharacterVoicePrompt({
      novelTitle: '星海の旅人',
      characters: [
        {
          name: 'アリス',
          category: '主人公',
          firstPerson: '私',
          secondPerson: 'あなた',
          speechPattern: '丁寧語、〜ですわ',
        },
      ],
      body: 'アリス「俺は行くぜ！」',
    });
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('一人称: 私');
    expect(prompt).toContain('アリス「俺は行くぜ！」');
  });

  it('analyzeSettingImpactPrompt が正しくプロンプトを構築すること', () => {
    const prompt = analyzeSettingImpactPrompt({
      novelTitle: '星海の旅人',
      changeTarget: 'character',
      targetName: 'アリス',
      beforeValue: '年齢: 15歳',
      afterValue: '年齢: 25歳',
    });
    expect(prompt).toContain('アリス');
    expect(prompt).toContain('年齢: 15歳');
    expect(prompt).toContain('年齢: 25歳');
  });

  it('analyzeStoryArcPrompt が正しくプロンプトを構築すること', () => {
    const prompt = analyzeStoryArcPrompt({
      novelTitle: '星海の旅人',
      chapters: [
        {
          id: 'c1',
          title: '第1章',
          sections: [{ id: 's1', title: '節1', summary: '旅立ち' }],
        },
      ],
    });
    expect(prompt).toContain('第1章');
    expect(prompt).toContain('旅立ち');
    expect(prompt).toContain('tension');
  });

  it('multiPersonaReviewPrompt が正しくプロンプトを構築すること', () => {
    const prompt = multiPersonaReviewPrompt({
      novelTitle: '星海の旅人',
      chapterTitle: '第1章',
      text: '宇宙船が起動した。',
    });
    expect(prompt).toContain('星海の旅人');
    expect(prompt).toContain('宇宙船が起動した。');
    expect(prompt).toContain('editor');
    expect(prompt).toContain('casual');
  });
});
