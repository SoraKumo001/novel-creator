import { describe, expect, it, vi } from "vitest";

vi.mock("../src/rag.js", () => ({
  searchContext: vi.fn().mockResolvedValue({ characters: "", settings: "" }),
  upsertEntityEmbedding: vi.fn().mockResolvedValue(undefined),
}));

import {
  ChapterDomainService,
  ContentDomainService,
  countWords,
  ForeshadowingDomainService,
  LlmInstructionDomainService,
  NotFoundError,
  NovelDomainService,
  SectionDomainService,
  type ServiceContext,
  TimelineDomainService,
  ValidationError,
} from "../src/core/index.js";

function createMockContext(mockDb: unknown): ServiceContext {
  return {
    db: mockDb as never,
    embedding: {} as never,
    env: {} as never,
    llm: {} as never,
    vectorStore: {
      deleteByEntity: vi.fn().mockResolvedValue(undefined),
      deleteByNovel: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
    } as never,
  };
}

describe("Domain Services", () => {
  describe("NovelDomainService", () => {
    it("listNovels - 小説一覧を取得できること", async () => {
      const sampleNovels = [{ id: "n1", title: "小説1" }];
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

    it("getNovelDetail - 小説が存在しない場合に NotFoundError をスローすること", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const service = new NovelDomainService(createMockContext(mockDb));
      await expect(service.getNovelDetail("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("createNovel - タイトルが空の場合に ValidationError をスローすること", async () => {
      const service = new NovelDomainService(createMockContext({}));
      await expect(service.createNovel({ title: "  " })).rejects.toThrow(
        ValidationError
      );
    });

    it("createNovel - 正しいデータで小説を作成できること", async () => {
      const created = { description: "説明", id: "n1", title: "新小説" };
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      };
      const service = new NovelDomainService(createMockContext(mockDb));
      const res = await service.createNovel({
        description: "説明",
        title: "新小説",
      });
      expect(res).toEqual(created);
    });
  });

  describe("ChapterDomainService & SectionDomainService", () => {
    it("ChapterDomainService.createChapter - タイトルが空の場合に ValidationError をスローすること", async () => {
      const service = new ChapterDomainService(createMockContext({}));
      await expect(
        service.createChapter({ novelId: "n1", title: "" })
      ).rejects.toThrow(ValidationError);
    });

    it("SectionDomainService.createSection - 節を作成できること", async () => {
      const created = {
        chapterId: "c1",
        id: "s1",
        order: 1,
        summary: null,
        title: "節1",
      };
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      const service = new SectionDomainService(createMockContext(mockDb));
      const res = await service.createSection({
        chapterId: "c1",
        title: "節1",
      });
      expect(res).toEqual(created);
    });
  });

  describe("ContentDomainService", () => {
    it("countWords - 日本語文字数と英単語数を正しくカウントすること", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("こんにちは世界")).toBe(7);
      expect(countWords("Hello world foo bar")).toBe(4);
    });

    it("getContent - 本文が存在しない場合に NotFoundError をスローすること", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const service = new ContentDomainService(createMockContext(mockDb));
      await expect(service.getContent("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("TimelineDomainService", () => {
    it("createTimeline - イベントが空の場合に ValidationError をスローすること", async () => {
      const service = new TimelineDomainService(createMockContext({}));
      await expect(
        service.createTimeline({ event: "", novelId: "n1" })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("LlmInstructionDomainService", () => {
    it("createInstruction - 指示が空の場合に ValidationError をスローすること", async () => {
      const service = new LlmInstructionDomainService(createMockContext({}));
      await expect(
        service.createInstruction({
          entityType: "character",
          instruction: " ",
          novelId: "n1",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("ForeshadowingDomainService", () => {
    it("createForeshadowing - タイトルが空の場合に ValidationError をスローすること", async () => {
      const service = new ForeshadowingDomainService(createMockContext({}));
      await expect(
        service.createForeshadowing("n1", { title: "  " })
      ).rejects.toThrow(ValidationError);
    });

    it("createForeshadowing - 正常に伏線を作成できること", async () => {
      const created = {
        category: "主要伏線",
        description: "メモ",
        id: "f-1",
        novelId: "n1",
        status: "unresolved",
        title: "テスト伏線",
      };
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "n1", title: "小説" }]),
          }),
        }),
      };
      const service = new ForeshadowingDomainService(createMockContext(mockDb));
      const res = await service.createForeshadowing("n1", {
        category: "主要伏線",
        description: "メモ",
        title: "テスト伏線",
      });
      expect(res).toEqual(created);
    });
  });
});
