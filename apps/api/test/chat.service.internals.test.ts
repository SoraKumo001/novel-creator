import { chatMessages, chatSessions, novels } from "@novel-creator/db";
import { creativeChatSystemPrompt, streamTextResult } from "@novel-creator/llm";
import type { LanguageModel, ToolSet } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatDomainService } from "../src/core/chat.service.js";
import { createProposeTools } from "../src/core/tools/proposeTools.js";
import { createReadTools } from "../src/core/tools/readTools.js";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "../src/core/types.js";
import { searchContext } from "../src/rag.js";

// searchContext をモック（buildChatContext の RAG 検索部分を分離して検証する）
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

// システムプロンプトとストリーム生成をモック（プロンプト構築の検証を単純化する）
vi.mock("@novel-creator/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@novel-creator/llm")>();
  return {
    ...actual,
    creativeChatSystemPrompt: vi.fn().mockReturnValue("MOCK_SYSTEM_PROMPT"),
    streamTextResult: vi.fn(),
  };
});

const mockSearchContext = vi.mocked(searchContext);
const mockStreamTextResult = vi.mocked(streamTextResult);

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const NOVEL_ID = "22222222-2222-4222-8222-222222222222";

/**
 * chat.service.ts の private メソッドへ型付きでアクセスするためのインターフェース。
 * 分割した各責務をユニットテストから直接検証するために使用する。
 */
type ChatServiceInternals = {
  ensureSession(sessionId: string): Promise<Record<string, unknown>>;
  persistUserMessage(
    sessionId: string,
    messages: { role: string; parts: { type: string; text?: string }[] }[]
  ): Promise<{ userText: string }>;
  buildChatContext(
    sessionId: string,
    effectiveNovelId: string | null | undefined,
    userText: string
  ): Promise<string>;
  buildChatTools(
    effectiveNovelId: string | null | undefined
  ): ToolSet | undefined;
  streamAssistantResponse(
    sessionId: string,
    llmModel: LanguageModel,
    prompt: string,
    tools: ToolSet | undefined
  ): Promise<Response>;
};

function internalsOf(service: ChatDomainService): ChatServiceInternals {
  return service as unknown as ChatServiceInternals;
}

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
              orderBy: vi.fn().mockResolvedValue(options.history ?? []),
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

function createService(db: unknown): ChatDomainService {
  const ctx = {
    db,
    embedding: {},
    env: {},
    llm: {},
    vectorStore: {},
  } as unknown as ServiceContext;
  return new ChatDomainService(ctx);
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
      const service = createService(db);

      const result = await internalsOf(service).ensureSession(SESSION_ID);

      expect(result).toEqual(session);
    });

    it("セッションが存在しない場合は NotFoundError を投げること", async () => {
      const { db } = createMockDb({ session: null });
      const service = createService(db);

      await expect(
        internalsOf(service).ensureSession(SESSION_ID)
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        internalsOf(service).ensureSession(SESSION_ID)
      ).rejects.toThrow("Chat session not found");
    });
  });

  describe("persistUserMessage", () => {
    it("最後の role=user メッセージの text パートを結合して永続化し、updatedAt を更新すること", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const service = createService(db);

      const parts = [
        { text: "こんにちは", type: "text" },
        { text: "世界", type: "text" },
      ];
      const { userText } = await internalsOf(service).persistUserMessage(
        SESSION_ID,
        [
          {
            parts: [{ text: "どうしましたか？", type: "text" }],
            role: "assistant",
          },
          { parts, role: "user" },
        ]
      );

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
      expect(
        (sessionUpdate?.values as { updatedAt: Date }).updatedAt
      ).toBeInstanceOf(Date);
    });

    it("role=user メッセージが存在しない場合は ValidationError を投げ、永続化しないこと", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const service = createService(db);

      const internals = internalsOf(service);
      await expect(
        internals.persistUserMessage(SESSION_ID, [
          {
            parts: [{ text: "どうしましたか？", type: "text" }],
            role: "assistant",
          },
        ])
      ).rejects.toBeInstanceOf(ValidationError);

      expect(insertCalls).toHaveLength(0);
      expect(updateCalls).toHaveLength(0);
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
      const service = createService(db);

      const prompt = await internalsOf(service).buildChatContext(
        SESSION_ID,
        undefined,
        "今回の質問"
      );

      // システムプロンプト + 履歴行が '\n\n' 連結される
      expect(prompt).toContain("MOCK_SYSTEM_PROMPT");
      expect(prompt).toContain("ユーザー: 前回の質問");
      expect(prompt).toContain("アシスタント: 前回の回答");
      expect(prompt.split("\n\n")).toHaveLength(3);

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
      const service = createService(db);

      const prompt = await internalsOf(service).buildChatContext(
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
      const service = createService(db);

      const prompt = await internalsOf(service).buildChatContext(
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
    });
  });

  describe("buildChatTools", () => {
    it("小説コンテキストがある場合に読み取りツールと提案ツールをマージすること", () => {
      const { db } = createMockDb({});
      const service = createService(db);
      vi.mocked(createReadTools).mockReturnValue({ getNovelInfo: {} } as never);
      vi.mocked(createProposeTools).mockReturnValue({
        proposeCreateCharacter: {},
      } as never);

      const tools = internalsOf(service).buildChatTools(NOVEL_ID);

      expect(tools).toEqual({ getNovelInfo: {}, proposeCreateCharacter: {} });
    });

    it("小説コンテキストがない場合は undefined を返しツールを構築しないこと", () => {
      const { db } = createMockDb({});
      const service = createService(db);

      const tools = internalsOf(service).buildChatTools(null);

      expect(tools).toBeUndefined();
      expect(createReadTools).not.toHaveBeenCalled();
      expect(createProposeTools).not.toHaveBeenCalled();
    });

    it("ツール構築に失敗してもエラーにせず undefined を返すこと", () => {
      const { db } = createMockDb({});
      const service = createService(db);
      vi.mocked(createReadTools).mockImplementation(() => {
        throw new Error("tool build failed");
      });

      const tools = internalsOf(service).buildChatTools(NOVEL_ID);

      expect(tools).toBeUndefined();
    });
  });

  describe("streamAssistantResponse", () => {
    it("ストリーム完了後に assistant メッセージを永続化し updatedAt を更新すること", async () => {
      const { db, insertCalls, updateCalls } = createMockDb({});
      const service = createService(db);
      mockStreamTextResult.mockResolvedValue(
        createFakeStreamResult("テスト回答") as never
      );

      const res = await internalsOf(service).streamAssistantResponse(
        SESSION_ID,
        {} as LanguageModel,
        "prompt",
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
});
