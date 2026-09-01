import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "../src/context.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import backupRouter from "../src/routes/backup.js";

// ---- DB モック ----
interface MockDb {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  const db = {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  };
  return db;
}

// テスト用の Hono アプリを構築する。
// db / vectorStore をモックに差し替え、backup ルーターとエラーハンドラのみを登録する。
function createTestApp(
  db: MockDb,
  vectorStore: { deleteByNovel: ReturnType<typeof vi.fn> }
) {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("env", {} as never);
    c.set("db", db as never);
    c.set("llm", {} as never);
    c.set("embedding", {} as never);
    c.set("vectorStore", vectorStore as never);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/backup", backupRouter);
  return app;
}

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const CHAPTER_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";

function makeBackup() {
  return {
    meta: {
      exportedAt: "2024-01-01T00:00:00.000Z",
      novelId: NOVEL_ID,
      novelTitle: "テスト小説",
      version: 1,
    },
    rdb: {
      chapters: [
        {
          id: CHAPTER_ID,
          novelId: NOVEL_ID,
          order: 1,
          summary: null,
          title: "第1章",
        },
      ],
      characters: [
        {
          category: "未分類",
          description: null,
          id: "55555555-5555-4555-8555-555555555555",
          name: "キャラ",
          novelId: NOVEL_ID,
          relationships: null,
          traits: null,
        },
      ],
      chatMessages: [
        {
          content: "こんにちは",
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          role: "user",
          sessionId: "99999999-9999-4999-8999-999999999999",
        },
      ],
      chatSessions: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          novelId: NOVEL_ID,
          title: "相談",
        },
      ],
      contents: [
        {
          body: "本文",
          id: "44444444-4444-4444-8444-444444444444",
          sectionId: SECTION_ID,
          wordCount: 2,
        },
      ],
      llmInstructions: [
        {
          entityType: "character",
          id: "88888888-8888-4888-8888-888888888888",
          instruction: "指示",
          novelId: NOVEL_ID,
        },
      ],
      novel: { description: null, id: NOVEL_ID, title: "テスト小説" },
      sections: [
        {
          chapterId: CHAPTER_ID,
          id: SECTION_ID,
          order: 1,
          summary: null,
          title: "節1",
        },
      ],
      settings: [
        {
          category: "舞台",
          description: null,
          id: "66666666-6666-4666-8666-666666666666",
          metadata: null,
          name: "世界観",
          novelId: NOVEL_ID,
        },
      ],
      timelines: [
        {
          event: "出来事",
          id: "77777777-7777-4777-8777-777777777777",
          novelId: NOVEL_ID,
          order: 1,
          sectionId: null,
          timestamp: null,
        },
      ],
    },
  };
}

describe("backup export/import", () => {
  let db: MockDb;
  let vectorStore: { deleteByNovel: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = createMockDb();
    vectorStore = { deleteByNovel: vi.fn().mockResolvedValue(undefined) };
  });

  it("POST /api/backup/export?novelId=... → 200 でバックアップオブジェクトが返ること", async () => {
    const backup = makeBackup();
    const novel = backup.rdb.novel;

    // select 呼び出しを順にモック:
    // 1) novel, 2) chapters, 3) sections, 4) contents, 5-8) characters/settings/timelines/llmInstructions (Promise.all), 9) chatSessions, 10) chatMessages
    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([novel]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.chapters),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.sections),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.contents),
        }),
      })
      // Promise.all 内の4つ (characters, settings, timelines, llmInstructions)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.characters),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.settings),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.timelines),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.llmInstructions),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.chatSessions),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(backup.rdb.chatMessages),
        }),
      });

    const app = createTestApp(db, vectorStore);
    const res = await app.request(`/api/backup/export?novelId=${NOVEL_ID}`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.version).toBe(1);
    expect(body.meta.novelId).toBe(NOVEL_ID);
    expect(body.rdb.novel.id).toBe(NOVEL_ID);
    expect(body.rdb.chapters).toHaveLength(1);
    expect(body.rdb.contents).toHaveLength(1);
  });

  it("POST /api/backup/export?novelId=... → novel 不在で 404 になること", async () => {
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const app = createTestApp(db, vectorStore);
    const res = await app.request(`/api/backup/export?novelId=${NOVEL_ID}`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/backup/import → 200 で復元され、孤立ベクトルが削除されること", async () => {
    const backup = makeBackup();

    // tx をモックした transaction
    const mockTx = {
      delete: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };
    db.transaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb(mockTx)
    );

    const app = createTestApp(db, vectorStore);
    const res = await app.request("/api/backup/import", {
      body: JSON.stringify(backup),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.novelId).toBe(NOVEL_ID);
    expect(body.counts.chapters).toBe(1);
    expect(body.counts.chatMessages).toBe(1);
    expect(mockTx.delete).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
    expect(vectorStore.deleteByNovel).toHaveBeenCalledWith(NOVEL_ID);
  });

  it("POST /api/backup/import → 不正なボディで 400 になること", async () => {
    const app = createTestApp(db, vectorStore);
    const res = await app.request("/api/backup/import", {
      body: JSON.stringify({ foo: "bar" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(400);
  });
});
