import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppContext } from "../src/context.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import chaptersRouter from "../src/routes/chapters.js";
import charactersRouter from "../src/routes/characters.js";
import contentsRouter from "../src/routes/contents.js";
import foreshadowingsRouter from "../src/routes/foreshadowings.js";
import novelsRouter from "../src/routes/novels.js";
import sectionsRouter from "../src/routes/sections.js";
import settingsRouter from "../src/routes/settings.js";
import timelinesRouter from "../src/routes/timelines.js";

const TEST_MASTER_SECRET = "test-master-secret-0123456789";

function createMockApp({
  userRole = "user",
  userId = "user-1",
  isMember = false,
}: {
  isMember?: boolean;
  userId?: string;
  userRole?: string;
}) {
  const app = new Hono<AppContext>();

  const mockDb = {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          if (isMember) {
            return Promise.resolve([
              {
                id: "member-1",
                novelId: "11111111-1111-4111-8111-111111111111",
              },
            ]);
          }
          return Promise.resolve([]);
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue(
              isMember
                ? [{ novelId: "11111111-1111-4111-8111-111111111111" }]
                : []
            ),
          innerJoin: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockResolvedValue(
                isMember
                  ? [{ novelId: "11111111-1111-4111-8111-111111111111" }]
                  : []
              ),
          }),
        }),
      })),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  const mockServices = {
    chapter: {
      deleteChapter: vi.fn().mockResolvedValue(undefined),
      getChapterWithSections: vi.fn().mockResolvedValue({
        chapter: {
          id: "11111111-1111-4111-8111-111111111111",
          novelId: "11111111-1111-4111-8111-111111111111",
          title: "章1",
        },
        sections: [],
      }),
      listChapters: vi.fn().mockResolvedValue([]),
      updateChapter: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    },
    character: {
      deleteCharacter: vi.fn().mockResolvedValue(undefined),
      getCharacter: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
      listCharacters: vi.fn().mockResolvedValue([]),
      updateCharacter: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    },
    content: {
      getContent: vi.fn().mockResolvedValue({
        body: "本文",
        sectionId: "11111111-1111-4111-8111-111111111111",
      }),
      updateContent: vi.fn().mockResolvedValue({
        sectionId: "11111111-1111-4111-8111-111111111111",
      }),
    },
    foreshadowing: {
      getForeshadowing: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
      getForeshadowingsByNovel: vi.fn().mockResolvedValue([]),
    },
    novel: {
      getNovelDetail: vi.fn().mockResolvedValue({
        chapters: [],
        characters: [],
        novel: { id: "11111111-1111-4111-8111-111111111111", title: "作品1" },
        settings: [],
      }),
      listNovels: vi.fn().mockResolvedValue([]),
    },
    section: {
      deleteSection: vi.fn().mockResolvedValue(undefined),
      getSectionWithContent: vi.fn().mockResolvedValue({
        content: { body: "本文" },
        section: {
          chapterId: "11111111-1111-4111-8111-111111111111",
          id: "11111111-1111-4111-8111-111111111111",
        },
      }),
      updateSection: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    },
    setting: {
      deleteSetting: vi.fn().mockResolvedValue(undefined),
      getSetting: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
      listSettings: vi.fn().mockResolvedValue([]),
      updateSetting: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    },
    timeline: {
      deleteTimeline: vi.fn().mockResolvedValue(undefined),
      listTimelines: vi.fn().mockResolvedValue([]),
      updateTimeline: vi
        .fn()
        .mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    },
  };

  app.use("*", async (c, next) => {
    c.set("env", { MASTER_SECRET: TEST_MASTER_SECRET } as never);
    c.set("db", mockDb as never);
    c.set("services", mockServices as never);
    c.set("user", {
      email: "test@example.com",
      emailVerified: true,
      id: userId,
      image: null,
      name: "Test User",
      role: userRole,
    });
    await next();
  });

  app.onError(errorHandler);
  app.route("/api/chapters", chaptersRouter);
  app.route("/api/sections", sectionsRouter);
  app.route("/api/contents", contentsRouter);
  app.route("/api/characters", charactersRouter);
  app.route("/api/settings", settingsRouter);
  app.route("/api/timelines", timelinesRouter);
  app.route("/api/foreshadowings", foreshadowingsRouter);
  app.route("/api/novels", novelsRouter);

  return app;
}

describe("Security: Object Level Authorization (BOLA/IDOR)", () => {
  it("非メンバーのユーザーによる /api/chapters/:id 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/chapters/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーのユーザーによる /api/sections/:id/content 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/sections/11111111-1111-4111-8111-111111111111/content"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーのユーザーによる /api/contents/:id 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/contents/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーのユーザーによる /api/characters/:id 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/characters/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーのユーザーによる /api/settings/:id 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/settings/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーのユーザーによる /api/novels/:id/chapters 取得は 403 で拒否されること", async () => {
    const app = createMockApp({ isMember: false });
    const res = await app.request(
      "/api/novels/11111111-1111-4111-8111-111111111111/chapters"
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("管理者 (admin) は作品メンバーシップがなくても 200 でアクセスできること", async () => {
    const app = createMockApp({ isMember: false, userRole: "admin" });
    const res = await app.request(
      "/api/novels/11111111-1111-4111-8111-111111111111/chapters"
    );
    expect(res.status).toBe(200);
  });
});
