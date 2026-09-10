import { chatMessages, chatSessions, novels } from "@novel-creator/db";
import { creativeChatSystemPrompt, streamTextResult } from "@novel-creator/llm";
import type { LanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildChatContextPrompt } from "../src/core/chat/chat-context.js";
import {
  ensureChatSession,
  persistChatUserMessage,
} from "../src/core/chat/chat-sessions.js";
import {
  buildChatTools,
  streamChatAssistantResponse,
} from "../src/core/chat/chat-stream.js";
import { ChatDomainService } from "../src/core/chat.service.js";
import { resolveLLMModelWithInfo } from "../src/core/model-resolver.js";
import { createProposeTools } from "../src/core/tools/proposeTools.js";
import { createReadTools } from "../src/core/tools/readTools.js";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "../src/core/types.js";
import { searchContext } from "../src/rag.js";

// searchContext をモック（buildChatContextPrompt の RAG 検索部分を分離して検証する）
vi.mock("../src/rag.js", () => ({
  searchContext: vi.fn(),
}));

// ツール構築をモック（buildChatTools のマージ / フォールバックを検証する）
vi.mock("../src/core/tools/readTools.js", () => ({
  createReadTools: vi.fn(),
}));
vi.mock("../src/core/tools/proposeTools.js", () => ({
  createProposeTools: vi.fn(),
}));

// モデル解決をモック（streamCreativeChat の並列実行タイミング検証用）
vi.mock("../src/core/model-resolver.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/core/model-resolver.js")>();
  return {
    ...actual,
    resolveLLMModelWithInfo: vi.fn(),
  };
});

// システムプロンプトとストリーム生成をモック（プロンプト構築の検証を単純化する）
vi.mock("@novel-creator/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@novel-creator/llm")>();
  return {
    ...actual,
    creativeChatSystemPrompt: vi.fn().mockReturnValue("MOCK_SYSTEM_PROMPT"),
    streamTextResult: vi.fn(),
  };
});

// chat-context と chat-stream の関数をスパイ可能にする
vi.mock("../src/core/chat/chat-context.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/core/chat/chat-context.js")>();
  return {
    ...actual,
    buildChatContextPrompt: vi.fn(actual.buildChatContextPrompt),
  };
});
vi.mock("../src/core/chat/chat-stream.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/core/chat/chat-stream.js")>();
  return {
    ...actual,
    streamChatAssistantResponse: vi.fn(actual.streamChatAssistantResponse),
  };
});

const mockSearchContext = vi.mocked(searchContext);
const mockResolveLLMModelWithInfo = vi.mocked(resolveLLMModelWithInfo);
const mockStreamTextResult = vi.mocked(streamTextResult);
const mockBuildChatContextPrompt = vi.mocked(buildChatContextPrompt);
const mockStreamChatAssistantResponse = vi.mocked(streamChatAssistantResponse);

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const NOVEL_ID = "22222222-2222-4222-8222-222222222222";

/**
 * chat.service が使う DB チェーンをテーブル参照で振り分けるモック DB を構築する。
 * insert / update の呼び出しを記録する。
 */
function createMockDb(
  options: {
    session?: Record<string, unknown> | null;
    history?: Record<string, unknown>[];
    novel?: Record<string, unknown> | null;
  } = {}
) {
  const insertCalls: { table: unknown; values: unknown }[] = [];
  const updateCalls: { table: unknown; values: unknown }[] = [];
  const selectedTables: unknown[] = [];

  const db = {
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: vi.fn().mockImplementation((values: unknown) => {
        insertCalls.push({ table, values });
        return { returning: vi.fn().mockResolvedValue([]) };
      }),
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        selectedTables.push(table);
        if (table === chatSessions) {
          return {
            where: vi
              .fn()
              .mockResolvedValue(options.session ? [options.session] : []),
          };
        }
        if (table === chatMessages) {
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockImplementation(() =>
                Object.assign(Promise.resolve(options.history ?? []), {
                  limit: vi.fn().mockResolvedValue(options.history ?? []),
                })
              ),
            }),
          };
        }
        if (table === novels) {
          return {
            where: vi
              .fn()
              .mockResolvedValue(options.novel ? [options.novel] : []),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((values: unknown) => {
        updateCalls.push({ table, values });
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
  };

  return { db, insertCalls, selectedTables, updateCalls };
}

function createTestContext(db: unknown): ServiceContext {
  return {
    db,
    embedding: {},
    env: {},
    llm: {},
    vectorStore: {},
  } as unknown as ServiceContext;
}

function createService(db: unknown): ChatDomainService {
  return new ChatDomainService(createTestContext(db));
}

/**
 * テキストを stream する偽の StreamTextResult を構築する。
 * toUIMessageStream が消費できる TextStreamPart の ReadableStream を返す。
 */
function createFakeStreamResult(text: string) {
  const id = "text-1";
  const parts = [
    { type: "start" },
    { id, type: "text-start" },
    { id, text, type: "text-delta" },
    { id, type: "text-end" },
    {
      finishReason: "stop",
      rawFinishReason: "stop",
      totalUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
      type: "finish",
    },
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const p of parts) {
        controller.enqueue(p);
      }
      controller.close();
    },
  });
  return { stream };
}

describe("ChatDomainService - 分割された責務のユニットテスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureSession", () => {
    it("セッションが存在する場合はセッション行を返すこと", async () => {
      const session = { id: SESSION_ID, novelId: null, title: "相談" };
      const { db } = createMockDb({ session });
      const ctx = createTestContext(db);

      const result = await ensureChatSession(ctx, SESSION_ID);

      expect(result).toEqual(session);
    });

    it("セッションが存在しない場合は NotFoundError を投げること", async () => {
      const { db } = createMockDb({ session: null });
      const ctx = createTestContext(db);

      await expect(ensureChatSession(ctx, SESSION_ID)).rejects.toBeInstanceOf(
        NotFoundError
      );
      await expect(ensureChatSession(ctx, SESSION_ID)).rejects.toThrow(
        "Chat session not found"
      );
    });
  });

  describe("persistUserMessage", () => {
    it("最後の role=user メッセージの text パートを結合して永続化し、updatedAt を更新すること", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const ctx = createTestContext(db);

      const parts = [
        { text: "こんにちは", type: "text" },
        { text: "世界", type: "text" },
      ];
      const { userText } = await persistChatUserMessage(ctx, SESSION_ID, [
        {
          parts: [{ text: "どうしましたか？", type: "text" }],
          role: "assistant",
        },
        { parts, role: "user" },
      ]);

      // 途中の assistant を無視して最後の user メッセージが採用される
      expect(userText).toBe("こんにちは世界");

      // ユーザーメッセージが挿入される
      const userInsert = insertCalls.find((c) => c.table === chatMessages);
      expect(userInsert).toBeDefined();
      expect(userInsert?.values).toEqual({
        content: "こんにちは世界",
        parts,
        role: "user",
        sessionId: SESSION_ID,
      });

      // セッションの updatedAt が更新される
      const sessionUpdate = updateCalls.find((c) => c.table === chatSessions);
      expect(sessionUpdate).toBeDefined();
      const sessionValues = sessionUpdate?.values as
        | { updatedAt: Date }
        | undefined;
      expect(sessionValues?.updatedAt).toBeInstanceOf(Date);
    });

    it("role=user メッセージが存在しない場合は ValidationError を投げ、永続化しないこと", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const ctx = createTestContext(db);

      await expect(
        persistChatUserMessage(ctx, SESSION_ID, [
          {
            parts: [{ text: "どうしましたか？", type: "text" }],
            role: "assistant",
          },
        ])
      ).rejects.toBeInstanceOf(ValidationError);

      expect(insertCalls).toHaveLength(0);
      expect(updateCalls).toHaveLength(0);
    });

    it("直前の user メッセージと同文かつ 30 秒以内は再保存をスキップすること", async () => {
      const { db, insertCalls } = createMockDb({
        history: [
          {
            content: "こんにちは世界",
            createdAt: new Date(),
            id: "m1",
            parts: null,
            role: "user",
            sessionId: SESSION_ID,
          },
        ],
      });
      const ctx = createTestContext(db);

      const { userText } = await persistChatUserMessage(ctx, SESSION_ID, [
        {
          parts: [{ text: "こんにちは世界", type: "text" }],
          role: "user",
        },
      ]);

      expect(userText).toBe("こんにちは世界");
      // 重複のため user 行の再保存はスキップされる
      expect(insertCalls.filter((c) => c.table === chatMessages)).toHaveLength(
        0
      );
    });
  });

  describe("buildChatContext", () => {
    it("DB 履歴からプロンプトを構築すること（小説コンテキストなし）", async () => {
      const { db, selectedTables } = createMockDb({
        history: [
          {
            content: "前回の質問",
            id: "m1",
            parts: null,
            role: "user",
            sessionId: SESSION_ID,
          },
          {
            content: "前回の回答",
            id: "m2",
            parts: null,
            role: "assistant",
            sessionId: SESSION_ID,
          },
        ],
      });
      const ctx = createTestContext(db);

      const { prompt, warnings } = await buildChatContextPrompt(
        ctx,
        SESSION_ID,
        undefined,
        "今回の質問"
      );

      // システムプロンプト + 履歴行が '\n\n' 連結される
      expect(prompt).toContain("MOCK_SYSTEM_PROMPT");
      expect(prompt).toContain("ユーザー: 前回の質問");
      expect(prompt).toContain("アシスタント: 前回の回答");
      expect(prompt.split("\n\n")).toHaveLength(3);
      expect(warnings).toEqual([]);

      // 小説コンテキストがない場合は novels を取得せず RAG も検索しない
      expect(mockSearchContext).not.toHaveBeenCalled();
      expect(selectedTables).not.toContain(novels);
      expect(vi.mocked(creativeChatSystemPrompt)).toHaveBeenCalledWith({
        characters: [],
        novel: undefined,
        settings: [],
      });
    });

    it("小説情報と RAG 検索結果をシステムプロンプトに渡すこと", async () => {
      const { db } = createMockDb({
        history: [
          {
            content: "今回の質問",
            id: "m1",
            parts: null,
            role: "user",
            sessionId: SESSION_ID,
          },
        ],
        novel: {
          description: "説明",
          id: NOVEL_ID,
          styleGuide: null,
          title: "テスト小説",
        },
      });
      mockSearchContext.mockResolvedValue({
        characters: ["人物Aの説明"],
        settings: ["設定Aの説明"],
      });
      const ctx = createTestContext(db);

      const { prompt, warnings } = await buildChatContextPrompt(
        ctx,
        SESSION_ID,
        NOVEL_ID,
        "今回の質問"
      );

      expect(mockSearchContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        NOVEL_ID,
        { query: "今回の質問" },
        expect.anything()
      );
      expect(vi.mocked(creativeChatSystemPrompt)).toHaveBeenCalledWith({
        characters: ["人物Aの説明"],
        novel: { description: "説明", styleGuide: null, title: "テスト小説" },
        settings: ["設定Aの説明"],
      });
      expect(prompt).toContain("ユーザー: 今回の質問");
      expect(warnings).toEqual([]);
    });

    it("RAG 検索が失敗しても空コンテキストでプロンプトを構築すること", async () => {
      const { db } = createMockDb({
        history: [
          {
            content: "今回の質問",
            id: "m1",
            parts: null,
            role: "user",
            sessionId: SESSION_ID,
          },
        ],
        novel: {
          description: null,
          id: NOVEL_ID,
          styleGuide: null,
          title: "テスト小説",
        },
      });
      mockSearchContext.mockRejectedValue(new Error("rag unavailable"));
      const ctx = createTestContext(db);

      const { prompt, warnings } = await buildChatContextPrompt(
        ctx,
        SESSION_ID,
        NOVEL_ID,
        "今回の質問"
      );

      // エラーにせず、小説情報は維持・設定/人物は空でプロンプトが構築される
      expect(vi.mocked(creativeChatSystemPrompt)).toHaveBeenCalledWith({
        characters: [],
        novel: { description: null, styleGuide: null, title: "テスト小説" },
        settings: [],
      });
      expect(prompt).toContain("ユーザー: 今回の質問");
      // 失敗は warnings に記録され、呼び出し元が UI 警告できる
      expect(warnings).toContain("rag_unavailable");
    });

    it("要求 novelId とセッションの novelId が不一致の場合は ValidationError を投げること", async () => {
      const { db } = createMockDb({ history: [] });
      const ctx = createTestContext(db);

      await expect(
        buildChatContextPrompt(
          ctx,
          SESSION_ID,
          NOVEL_ID,
          "今回の質問",
          "33333333-3333-4333-8333-333333333333"
        )
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("buildChatTools", () => {
    it("小説コンテキストがある場合に読み取りツールと提案ツールをマージすること", () => {
      const { db } = createMockDb({});
      const ctx = createTestContext(db);
      vi.mocked(createReadTools).mockReturnValue({ getNovelInfo: {} } as never);
      vi.mocked(createProposeTools).mockReturnValue({
        proposeCreateCharacter: {},
      } as never);

      const tools = buildChatTools(ctx, NOVEL_ID);

      expect(tools).toEqual({ getNovelInfo: {}, proposeCreateCharacter: {} });
    });

    it("小説コンテキストがない場合は undefined を返しツールを構築しないこと", () => {
      const { db } = createMockDb({});
      const ctx = createTestContext(db);

      const tools = buildChatTools(ctx, null);

      expect(tools).toBeUndefined();
      expect(createReadTools).not.toHaveBeenCalled();
      expect(createProposeTools).not.toHaveBeenCalled();
    });

    it("ツール構築に失敗してもエラーにせず undefined を返すこと", () => {
      const { db } = createMockDb({});
      const ctx = createTestContext(db);
      vi.mocked(createReadTools).mockImplementation(() => {
        throw new Error("tool build failed");
      });

      const tools = buildChatTools(ctx, NOVEL_ID);

      expect(tools).toBeUndefined();
    });
  });

  describe("streamAssistantResponse", () => {
    it("ストリーム完了後に assistant メッセージを永続化し updatedAt を更新すること", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const ctx = createTestContext(db);
      mockStreamTextResult.mockResolvedValue(
        createFakeStreamResult("テスト回答") as never
      );

      const res = await streamChatAssistantResponse(
        ctx,
        SESSION_ID,
        {
          model: {} as LanguageModel,
          modelId: "test-model",
          provider: "openai",
        },
        "prompt",
        undefined,
        undefined
      );

      expect(res.status).toBe(200);

      // ストリームを最後まで消費して onEnd（assistant 保存）を完了させる
      const text = await res.text();
      expect(text).toContain('"type":"text-delta"');
      expect(text).toContain("テスト回答");

      const assistantInsert = insertCalls.find((c) => c.table === chatMessages);
      expect(assistantInsert).toBeDefined();
      expect(assistantInsert?.values).toEqual({
        content: "テスト回答",
        parts: [{ state: "done", text: "テスト回答", type: "text" }],
        role: "assistant",
        sessionId: SESSION_ID,
      });

      const sessionUpdate = updateCalls.find((c) => c.table === chatSessions);
      expect(sessionUpdate).toBeDefined();
    });
  });

  describe("parallel fan-out", () => {
    it("3ブランチ (履歴・小説・RAG) と buildChatContext/resolveLLMModel が合計ではなく最大時間で完了すること", async () => {
      const sleep = (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, ms));
      const BRANCH_DELAY_MS = 80;

      // chat-context の 3 ブランチをそれぞれ遅延させる
      mockSearchContext.mockImplementation(async () => {
        await sleep(BRANCH_DELAY_MS);
        return { characters: ["人物Aの説明"], settings: ["設定Aの説明"] };
      });
      const delayedDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table: unknown) => {
            if (table === chatMessages) {
              return {
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockImplementation(() =>
                    Object.assign(
                      (async () => {
                        await sleep(BRANCH_DELAY_MS);
                        return [
                          {
                            content: "前回の質問",
                            id: "m1",
                            parts: null,
                            role: "user",
                            sessionId: SESSION_ID,
                          },
                        ];
                      })(),
                      {
                        limit: vi.fn().mockImplementation(async () => {
                          await sleep(BRANCH_DELAY_MS);
                          return [
                            {
                              content: "前回の質問",
                              id: "m1",
                              parts: null,
                              role: "user",
                              sessionId: SESSION_ID,
                            },
                          ];
                        }),
                      }
                    )
                  ),
                }),
              };
            }
            if (table === novels) {
              return {
                where: vi.fn().mockImplementation(async () => {
                  await sleep(BRANCH_DELAY_MS);
                  return [
                    {
                      description: "説明",
                      styleGuide: null,
                      title: "テスト小説",
                    },
                  ];
                }),
              };
            }
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        })),
      };
      const contextCtx = createTestContext(delayedDb);

      const contextStart = Date.now();
      const { prompt } = await buildChatContextPrompt(
        contextCtx,
        SESSION_ID,
        NOVEL_ID,
        "今回の質問"
      );
      const contextElapsed = Date.now() - contextStart;

      // 逐次実行なら 240ms (= 80ms x 3) 以上かかるため、200ms 未満なら並列実行の証拠になる
      expect(contextElapsed).toBeLessThan(200);
      expect(prompt).toContain("MOCK_SYSTEM_PROMPT");
      expect(prompt).toContain("ユーザー: 前回の質問");
      expect(vi.mocked(creativeChatSystemPrompt)).toHaveBeenCalledWith({
        characters: ["人物Aの説明"],
        novel: { description: "説明", styleGuide: null, title: "テスト小説" },
        settings: ["設定Aの説明"],
      });

      // サービス層: buildChatContextPrompt と resolveLLMModelWithInfo の並列実行
      const SERVICE_DELAY_MS = 100;
      mockBuildChatContextPrompt.mockClear();
      vi.mocked(createReadTools).mockReturnValue({} as never);
      const { db } = createMockDb({
        session: { id: SESSION_ID, novelId: NOVEL_ID, title: "相談" },
      });
      const service = createService(db);
      mockResolveLLMModelWithInfo.mockImplementation(async () => {
        await sleep(SERVICE_DELAY_MS);
        return {
          model: {} as LanguageModel,
          modelId: "test-model",
          provider: "ollama",
        };
      });
      mockBuildChatContextPrompt.mockImplementation(async () => {
        await sleep(SERVICE_DELAY_MS);
        return { prompt: "PARALLEL_PROMPT", warnings: [] };
      });
      mockStreamChatAssistantResponse.mockResolvedValue(new Response("ok"));

      const serviceStart = Date.now();
      const res = await service.streamCreativeChat({
        messages: [
          {
            parts: [{ text: "こんにちは", type: "text" }],
            role: "user" as const,
          },
        ],
        modelConfigId: null,
        novelId: NOVEL_ID,
        sessionId: SESSION_ID,
      });
      const serviceElapsed = Date.now() - serviceStart;

      // 逐次実行なら 200ms (= 100ms x 2) 以上かかるため、160ms 未満なら並列実行の証拠になる
      expect(res.status).toBe(200);
      expect(serviceElapsed).toBeLessThan(160);
      expect(mockBuildChatContextPrompt).toHaveBeenCalledTimes(1);
      expect(mockResolveLLMModelWithInfo).toHaveBeenCalledTimes(1);
      expect(mockStreamChatAssistantResponse).toHaveBeenCalledTimes(1);
      expect(mockStreamChatAssistantResponse.mock.calls[0]?.[3]).toBe(
        "PARALLEL_PROMPT"
      );
    });
  });
});
