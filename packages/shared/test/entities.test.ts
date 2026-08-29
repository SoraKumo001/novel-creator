import { describe, expect, it } from 'vitest';
import {
  chapterSchema,
  characterSchema,
  chatMessageSchema,
  chatSessionSchema,
  contentSchema,
  foreshadowingSchema,
  foreshadowingStatusSchema,
  llmInstructionSchema,
  novelSchema,
  sectionSchema,
  settingSchema,
  timelineSchema,
} from '../src/schemas/entities.js';

describe('entities schemas', () => {
  it('Novel の完全なオブジェクトをパースできること', () => {
    const result = novelSchema.parse({
      id: 'n1',
      title: 'タイトル',
      description: '説明',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(result.title).toBe('タイトル');
  });

  it('Novel.description は null を受け付けること', () => {
    const result = novelSchema.parse({
      id: 'n1',
      title: 'タイトル',
      description: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(result.description).toBeNull();
  });

  it('Chapter / Section / Content の完全なオブジェクトをパースできること', () => {
    const chapter = chapterSchema.parse({
      id: 'c1',
      novelId: 'n1',
      title: '第一章',
      order: 1,
      summary: null,
      createdAt: null,
      updatedAt: null,
    });
    const section = sectionSchema.parse({
      id: 's1',
      chapterId: 'c1',
      title: null,
      order: 1,
      summary: '要約',
      createdAt: null,
      updatedAt: null,
    });
    const content = contentSchema.parse({
      id: 'ct1',
      sectionId: 's1',
      body: '本文',
      wordCount: 100,
      createdAt: null,
      updatedAt: null,
    });
    expect(chapter.order).toBe(1);
    expect(section.title).toBeNull();
    expect(content.wordCount).toBe(100);
  });

  it('Character.traits は null と string[] の両方を受け付けること', () => {
    const withNull = characterSchema.parse({
      id: 'ch1',
      novelId: 'n1',
      category: '主要人物',
      name: '主人公',
      description: null,
      traits: null,
      relationships: null,
      createdAt: null,
      updatedAt: null,
    });
    const withArray = characterSchema.parse({
      id: 'ch1',
      novelId: 'n1',
      category: '主要人物',
      name: '主人公',
      description: null,
      traits: ['勇敢', '冷静'],
      relationships: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(withNull.traits).toBeNull();
    expect(withArray.traits).toEqual(['勇敢', '冷静']);
  });

  it('Character.relationships は文字列とオブジェクトの両方を受け付けること', () => {
    const asString = characterSchema.parse({
      id: 'ch1',
      novelId: 'n1',
      category: '主要人物',
      name: '主人公',
      description: null,
      traits: null,
      relationships: 'ヒロインの幼馴染。',
      createdAt: null,
      updatedAt: null,
    });
    const asObject = characterSchema.parse({
      id: 'ch1',
      novelId: 'n1',
      category: '主要人物',
      name: '主人公',
      description: null,
      traits: null,
      relationships: { hero: '主人公', heroine: 'ヒロイン' },
      createdAt: null,
      updatedAt: null,
    });
    expect(asString.relationships).toBe('ヒロインの幼馴染。');
    expect(asObject.relationships).toEqual({ hero: '主人公', heroine: 'ヒロイン' });
  });

  it('Setting / Timeline / Foreshadowing / LlmInstruction の完全なオブジェクトをパースできること', () => {
    const setting = settingSchema.parse({
      id: 'st1',
      novelId: 'n1',
      category: '世界観',
      name: '魔法体系',
      description: null,
      metadata: { type: 'magic' },
      createdAt: null,
      updatedAt: null,
    });
    const timeline = timelineSchema.parse({
      id: 't1',
      novelId: 'n1',
      sectionId: null,
      event: '事件',
      order: 1,
      timestamp: null,
      createdAt: null,
    });
    const foreshadowing = foreshadowingSchema.parse({
      id: 'f1',
      novelId: 'n1',
      title: '伏線',
      description: null,
      status: 'unresolved',
      placedSectionId: null,
      resolvedSectionId: null,
      createdAt: null,
      updatedAt: null,
    });
    const llm = llmInstructionSchema.parse({
      id: 'l1',
      novelId: 'n1',
      entityType: 'character',
      instruction: '指示',
      createdAt: null,
    });
    expect(setting.metadata).toEqual({ type: 'magic' });
    expect(timeline.event).toBe('事件');
    expect(foreshadowing.status).toBe('unresolved');
    expect(llm.entityType).toBe('character');
  });

  it('Timeline は updatedAt を持たない（updatedAt なしでパースできる）こと', () => {
    const result = timelineSchema.parse({
      id: 't1',
      novelId: 'n1',
      sectionId: null,
      event: '事件',
      order: 1,
      timestamp: null,
      createdAt: null,
    });
    expect(result).not.toHaveProperty('updatedAt');
  });

  it('foreshadowingStatusSchema は 3 値をすべて受け付けること', () => {
    expect(foreshadowingStatusSchema.parse('unresolved')).toBe('unresolved');
    expect(foreshadowingStatusSchema.parse('resolved')).toBe('resolved');
    expect(foreshadowingStatusSchema.parse('abandoned')).toBe('abandoned');
  });

  it('foreshadowingStatusSchema は不正な値を拒否すること', () => {
    expect(() => foreshadowingStatusSchema.parse('invalid')).toThrow();
  });

  it('ChatSession の完全なオブジェクトをパースできること', () => {
    const result = chatSessionSchema.parse({
      id: 'cs1',
      novelId: null,
      title: 'セッション',
      createdAt: null,
      updatedAt: null,
    });
    expect(result.title).toBe('セッション');
  });

  it('ChatMessage は user / assistant ロールを受け付けること', () => {
    const user = chatMessageSchema.parse({
      id: 'm1',
      sessionId: 'cs1',
      role: 'user',
      content: 'こんにちは',
      createdAt: null,
    });
    const assistant = chatMessageSchema.parse({
      id: 'm2',
      sessionId: 'cs1',
      role: 'assistant',
      content: 'こんにちは',
      createdAt: null,
    });
    expect(user.role).toBe('user');
    expect(assistant.role).toBe('assistant');
  });

  it('ChatMessage は system ロールを拒否すること', () => {
    expect(() =>
      chatMessageSchema.parse({
        id: 'm1',
        sessionId: 'cs1',
        role: 'system',
        content: 'システム',
        createdAt: null,
      }),
    ).toThrow();
  });
});
