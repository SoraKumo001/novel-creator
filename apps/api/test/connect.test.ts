import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChapterService, GenerateService, NovelService } from '@novel-creator/proto';

vi.mock('@novel-creator/llm', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@novel-creator/llm')>();
  return {
    ...mod,
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    streamText: vi.fn().mockImplementation(async function* () {
      yield '吾輩は';
      yield '猫である。';
    }),
  };
});

import { createConnectMiddleware } from '../src/connect.js';
import type { AppContext } from '../src/context.js';
import { errorHandler } from '../src/middleware/error-handler.js';

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createTestApp(db: MockDb, llm?: unknown) {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('env', {} as never);
    c.set('db', db as never);
    c.set('llm', (llm ?? {}) as never);
    c.set('embedding', {} as never);
    c.set('vectorStore', {
      delete: vi.fn(),
      deleteByNovel: vi.fn(),
      deleteByEntity: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
    } as never);
    await next();
  });
  app.use(
    '*',
    createConnectMiddleware((c) => ({
      env: c.var.env,
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
    })),
  );
  app.onError(errorHandler);
  return app;
}

// Hono の app.request を ConnectTransport の fetch に接続する
function createTestClient<T extends import('@bufbuild/protobuf').DescService>(
  service: T,
  app: Hono<AppContext>,
) {
  const transport = createConnectTransport({
    baseUrl: 'http://localhost',
    fetch: async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const req = new Request(url, init);
      return app.request(req);
    },
  });
  return createClient(service, transport);
}

describe('ConnectRPC Services', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('NovelService.CreateNovel → 正常に作成できること', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'gRPC小説',
      description: '説明文',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
      }),
    });

    const app = createTestApp(db);
    const client = createTestClient(NovelService, app);

    const res = await client.createNovel({
      title: 'gRPC小説',
      description: '説明文',
    });

    expect(res.id).toBe(created.id);
    expect(res.title).toBe('gRPC小説');
    expect(res.description).toBe('説明文');
  });

  it('NovelService.ListNovels → 一覧が取得できること', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: '小説1',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    });

    const app = createTestApp(db);
    const client = createTestClient(NovelService, app);

    const res = await client.listNovels({});
    expect(res.novels).toHaveLength(1);
    expect(res.novels[0].title).toBe('小説1');
  });

  it('ChapterService.ListChapters → 章一覧が取得できること', async () => {
    const rows = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        novelId: '11111111-1111-4111-8111-111111111111',
        title: '第1章',
        order: 1,
        summary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });

    const app = createTestApp(db);
    const client = createTestClient(ChapterService, app);

    const res = await client.listChapters({
      novelId: '11111111-1111-4111-8111-111111111111',
    });
    expect(res.chapters).toHaveLength(1);
    expect(res.chapters[0].title).toBe('第1章');
  });

  it('GenerateService.GenerateSectionContent → Server Streaming でチャンクが届くこと', async () => {
    const section = {
      id: '33333333-3333-4333-8333-333333333333',
      chapterId: '22222222-2222-4222-8222-222222222222',
      title: '第1節',
      order: 1,
      summary: 'テスト概要',
    };
    const chapter = {
      id: '22222222-2222-4222-8222-222222222222',
      novelId: '11111111-1111-4111-8111-111111111111',
      title: '第1章',
    };

    // 1回目: section, 2回目: chapter, 3回目: previousSections
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([section]),
      }),
    });
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([chapter]),
      }),
    });
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([section]),
        }),
      }),
    });

    // streamText をモックするための llm
    const mockLlm = {
      generateContentStream: vi.fn().mockImplementation(async function* () {
        yield { text: '吾輩は' };
        yield { text: '猫である。' };
      }),
    };

    const app = createTestApp(db, mockLlm);
    const client = createTestClient(GenerateService, app);

    const chunks: string[] = [];
    for await (const res of client.generateSectionContent({
      sectionId: '33333333-3333-4333-8333-333333333333',
    })) {
      chunks.push(res.chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});
