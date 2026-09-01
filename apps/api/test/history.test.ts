import { describe, expect, it, vi } from "vitest";
import {
  HistoryDomainService,
  NotFoundError,
  type ServiceContext,
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

describe("HistoryDomainService", () => {
  it("recordHistory - 履歴を正常に記録できること", async () => {
    const sampleHistory = {
      content: "本文テスト",
      createdAt: new Date(),
      description: "手動保存",
      entityId: "sec1",
      entityType: "content",
      id: "h1",
      novelId: "n1",
      title: "第1節",
      wordCount: 5,
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([sampleHistory]),
        }),
      }),
    };

    const service = new HistoryDomainService(createMockContext(mockDb));
    const res = await service.recordHistory({
      content: "本文テスト",
      description: "手動保存",
      entityId: "sec1",
      entityType: "content",
      novelId: "n1",
      title: "第1節",
      wordCount: 5,
    });

    expect(res).toEqual(sampleHistory);
  });

  it("getHistory - 存在しない場合に NotFoundError をスローすること", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const service = new HistoryDomainService(createMockContext(mockDb));
    await expect(service.getHistory("non-existent")).rejects.toThrow(
      NotFoundError
    );
  });

  it("listHistories - 履歴一覧を取得できること", async () => {
    const sampleHistories = [
      {
        entityId: "sec1",
        entityType: "content",
        id: "h1",
        novelId: "n1",
        title: "第1節",
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(sampleHistories),
            }),
          }),
        }),
      }),
    };

    const service = new HistoryDomainService(createMockContext(mockDb));
    const res = await service.listHistories("n1", {
      entityId: "sec1",
      entityType: "content",
    });
    expect(res).toEqual(sampleHistories);
  });
});
