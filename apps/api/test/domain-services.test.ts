import { describe, expect, it, vi } from 'vitest';
import {
  ChapterDomainService,
  ContentDomainService,
  countWords,
  LlmInstructionDomainService,
  NotFoundError,
  NovelDomainService,
  SectionDomainService,
  TimelineDomainService,
  ValidationError,
  type ServiceContext,
} from '../src/core/index.js';

function createMockContext(mockDb: unknown): ServiceContext {
  return {
    db: mockDb as never,
    llm: {} as never,
    embedding: {} as never,
    vectorStore: {
      deleteByNovel: vi.fn().mockResolvedValue(undefined),
      deleteByEntity: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    } as never,
    env: {} as never,
  };
}

describe('Domain Services', () => {
  describe('NovelDomainService', () => {
    it('listNovels - 小説一覧を取得できること', async () => {
      const sampleNovels = [{ id: 'n1', title: '小説1' }];
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(sampleNovels),
          }),
        }),
      };
      const service = new NovelDomainService(createMockContext(mockDb));
      const res = await service.listNovels();
      expect(res).toEqual(sampleNovels);
    });

    it('getNovelDetail - 小説が存在しない場合に NotFoundError をスローすること', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const service = new NovelDomainService(createMockContext(mockDb));
      await expect(service.getNovelDetail('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('createNovel - タイトルが空の場合に ValidationError をスローすること', async () => {
      const service = new NovelDomainService(createMockContext({}));
      await expect(service.createNovel({ title: '  ' })).rejects.toThrow(ValidationError);
    });

    it('createNovel - 正しいデータで小説を作成できること', async () => {
      const created = { id: 'n1', title: '新小説', description: '説明' };
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      };
      const service = new NovelDomainService(createMockContext(mockDb));
      const res = await service.createNovel({ title: '新小説', description: '説明' });
      expect(res).toEqual(created);
    });
  });

  describe('ChapterDomainService & SectionDomainService', () => {
    it('ChapterDomainService.createChapter - タイトルが空の場合に ValidationError をスローすること', async () => {
      const service = new ChapterDomainService(createMockContext({}));
      await expect(service.createChapter({ novelId: 'n1', title: '' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('SectionDomainService.createSection - 節を作成できること', async () => {
      const created = { id: 's1', chapterId: 'c1', title: '節1', order: 1, summary: null };
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      };
      const service = new SectionDomainService(createMockContext(mockDb));
      const res = await service.createSection({ chapterId: 'c1', title: '節1' });
      expect(res).toEqual(created);
    });
  });

  describe('ContentDomainService', () => {
    it('countWords - 日本語文字数と英単語数を正しくカウントすること', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('こんにちは世界')).toBe(7);
      expect(countWords('Hello world foo bar')).toBe(4);
    });

    it('getContent - 本文が存在しない場合に NotFoundError をスローすること', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const service = new ContentDomainService(createMockContext(mockDb));
      await expect(service.getContent('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('TimelineDomainService', () => {
    it('createTimeline - イベントが空の場合に ValidationError をスローすること', async () => {
      const service = new TimelineDomainService(createMockContext({}));
      await expect(service.createTimeline({ novelId: 'n1', event: '' })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('LlmInstructionDomainService', () => {
    it('createInstruction - 指示が空の場合に ValidationError をスローすること', async () => {
      const service = new LlmInstructionDomainService(createMockContext({}));
      await expect(
        service.createInstruction({ novelId: 'n1', entityType: 'character', instruction: ' ' }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
