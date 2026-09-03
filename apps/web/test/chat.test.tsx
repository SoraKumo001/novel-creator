import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildChatPrefill,
  buildChatPromptWithFocus,
} from "../src/components/chat/ChatDrawer.js";
import {
  ChatProvider,
  useChatStreamingState,
  useChatUI,
} from "../src/context/ChatContext.js";
import { rowToUIMessage } from "../src/hooks/useChatStreaming.js";

const mockFetch = vi.fn();

let queryClient: QueryClient;

/** テスト用に両 context の値をまとめて取得する（旧 useChat と同じ形状） */
function useTestChat() {
  const ui = useChatUI();
  const streaming = useChatStreamingState();
  return { ...ui, ...streaming };
}

function createChatWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChatProvider>{children}</ChatProvider>
      </QueryClientProvider>
    );
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/** AI SDK UI Message Stream（text パーツのみ）の SSE バイト列を組み立てる */
function uiMessageStreamBody(
  text: string,
  textPartId = "t1"
): ReadableStream<Uint8Array> {
  const events = [
    { type: "text-start", id: textPartId },
    { type: "text-delta", id: textPartId, delta: text },
    { type: "text-end", id: textPartId },
    { type: "finish", finishReason: "stop" },
  ];
  const sse = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse));
      controller.close();
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation(async () => jsonResponse([]));
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
});

describe("ChatContext & useChatUI / useChatStreamingState", () => {
  it("初期状態で閉じていること、openChat/closeChat/toggleChat で状態が変化すること", () => {
    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.messages).toEqual([]);

    act(() => {
      result.current.openChat("novel-123");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedNovelId).toBe("novel-123");

    act(() => {
      result.current.closeChat();
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleChat();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("createSession で新しいセッションが作成され一覧に追加されること", async () => {
    const newSession = {
      id: "sess-123",
      novelId: "novel-123",
      title: "プロット相談",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1回目: マウント時の一覧取得（空）
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    await waitFor(() => expect(result.current.loadingSessions).toBe(false));

    // 2回目: POST (create) のレスポンス
    // 3回目: invalidateQueries で再取得される GET (一覧) のレスポンス
    mockFetch
      .mockResolvedValueOnce(jsonResponse(newSession, 201))
      .mockResolvedValueOnce(jsonResponse([newSession]));

    await act(async () => {
      await result.current.createSession("novel-123", "プロット相談");
    });

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.sessions[0].title).toBe("プロット相談");
    expect(result.current.currentSessionId).toBe("sess-123");
  });

  it("startNewChat で currentSessionId と messages がリセットされること", () => {
    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    act(() => {
      result.current.startNewChat();
    });

    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("openChat に focus を渡すと chatFocus に保持され、consumeFocus でクリアされること", () => {
    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    expect(result.current.chatFocus).toBeNull();

    act(() => {
      result.current.openChat("novel-123", {
        entityType: "setting",
        title: "設定「大まかなあらすじ」",
        summary: "カテゴリー: 世界観\n説明: 魔法が衰退した世界",
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.chatFocus).toEqual({
      entityType: "setting",
      title: "設定「大まかなあらすじ」",
      summary: "カテゴリー: 世界観\n説明: 魔法が衰退した世界",
    });

    act(() => {
      result.current.consumeFocus();
    });

    expect(result.current.chatFocus).toBeNull();
  });

  it("focus 未指定の openChat は chatFocus を変更しないこと", () => {
    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    act(() => {
      result.current.openChat("novel-123");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.chatFocus).toBeNull();
  });

  it("sendMessage がセッション自動作成後に /api/chat へ sessionId を含めて送信し、応答を messages に反映すること", async () => {
    const createdSession = {
      id: "sess-abc",
      novelId: "novel-123",
      title: "テストの質問",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1: マウント時一覧取得（空）
    // 2: openChat による novelId 変更で sessions クエリキーが変わり再取得（空）
    // 3: 送信時にセッション作成 POST /api/chat/sessions
    // 4: 作成後 refreshSessions → GET 一覧
    // 以降: POST /api/chat（UI Message Stream）
    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdSession, 201))
      .mockResolvedValueOnce(jsonResponse([createdSession]))
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/chat")) {
          return new Response(uiMessageStreamBody("こんにちは、AIです"), {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          });
        }
        // タイトル自動更新 PUT と 一覧 GET はセッション一覧を返す
        if (url.includes("/api/chat/sessions")) {
          return jsonResponse([createdSession]);
        }
        return jsonResponse([]);
      });

    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    await waitFor(() => expect(result.current.loadingSessions).toBe(false));

    await act(async () => {
      await result.current.openChat("novel-123");
    });

    await act(async () => {
      await result.current.sendMessage("テストの質問");
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "テストの質問",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "こんにちは、AIです",
    });
    expect(result.current.currentSessionId).toBe("sess-abc");

    // /api/chat への送信ボディに sessionId / novelId が含まれることを検証する
    const chatCall = mockFetch.mock.calls.find((c) =>
      String(c[0]).endsWith("/api/chat")
    );
    expect(chatCall).toBeDefined();
    const body = JSON.parse(String(chatCall![1]?.body));
    expect(body.sessionId).toBe("sess-abc");
    expect(body.novelId).toBe("novel-123");
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("APIエラー発生時に error に詳細が設定され、clearError で解除できること", async () => {
    const createdSession = {
      id: "sess-err",
      novelId: null,
      title: "エラーのテスト",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdSession, 201))
      .mockResolvedValueOnce(jsonResponse([createdSession]))
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/chat")) {
          return new Response(
            JSON.stringify({ error: "LLM API のレート制限に達しました。" }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return jsonResponse([]);
      });

    const { result } = renderHook(() => useTestChat(), {
      wrapper: createChatWrapper(),
    });

    await waitFor(() => expect(result.current.loadingSessions).toBe(false));

    await act(async () => {
      await result.current.sendMessage("エラーのテスト");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.lastPrompt).toBe("エラーのテスト");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

describe("buildChatPromptWithFocus", () => {
  it("focus が null のときはユーザー入力をそのまま返すこと", () => {
    const text = buildChatPromptWithFocus("こんにちは", null);
    expect(text).toBe("こんにちは");
  });

  it("summary があるときは参照コンテキストヘッダーと現在内容を前置してユーザー入力を合成すること", () => {
    const text = buildChatPromptWithFocus("この設定を深掘りして", {
      entityType: "setting",
      title: "世界観設定",
      summary: "魔法が失われた近未来",
    });
    expect(text).toContain("【参照コンテキスト: 世界観設定】");
    expect(text).toContain("--- 現在の内容 ---");
    expect(text).toContain("魔法が失われた近未来");
    expect(text).toContain("--- ここまで ---");
    expect(text.endsWith("この設定を深掘りして")).toBe(true);
  });

  it("selectedText があるときは選択テキスト引用を前置してユーザー入力を合成すること", () => {
    const text = buildChatPromptWithFocus("この描写をより劇的にして", {
      entityType: "selection",
      title: "第1話 プロローグ",
      selectedText: "彼は剣を抜いた。",
    });
    expect(text).toContain("【参照中のテキスト（第1話 プロローグ）】");
    expect(text).toContain("彼は剣を抜いた。");
    expect(text.endsWith("この描写をより劇的にして")).toBe(true);
  });

  it("summary が空のときはタイトルのみ前置してユーザー入力を合成すること", () => {
    const text = buildChatPromptWithFocus("新しい人物を追加したい", {
      entityType: "character",
      title: "人物「ヒロイン」",
    });
    expect(text).toContain("【参照コンテキスト: 人物「ヒロイン」】");
    expect(text).not.toContain("--- 現在の内容 ---");
    expect(text.endsWith("新しい人物を追加したい")).toBe(true);
  });
});

describe("buildChatPrefill", () => {
  it("summary があるときはテンプレート形式に展開し末尾に改行を付けること", () => {
    const text = buildChatPrefill({
      entityType: "setting",
      title: "設定「大まかなあらすじ」",
      summary: "カテゴリー: 世界観\n説明: 魔法が衰退した世界",
    });
    expect(text).toContain("設定「大まかなあらすじ」について相談したいです。");
    expect(text).toContain("--- 現在の内容 ---");
    expect(text).toContain("カテゴリー: 世界観");
    expect(text).toContain("--- ここまで ---");
    expect(text.endsWith("\n\n")).toBe(true);
  });

  it("summary が無いときはヘッダーのみを返すこと", () => {
    const text = buildChatPrefill({
      entityType: "character",
      title: "人物「主人公」",
    });
    expect(text).toBe("人物「主人公」について相談したいです。\n\n");
  });

  it("summary が空文字のときはヘッダーのみを返すこと", () => {
    const text = buildChatPrefill({
      entityType: "character",
      title: "人物「主人公」",
      summary: "   ",
    });
    expect(text).toBe("人物「主人公」について相談したいです。\n\n");
  });

  it("selectedText があるときは選択テキスト引用フォーマットを返すこと", () => {
    const text = buildChatPrefill({
      entityType: "selection",
      title: "第1話 プロローグ",
      selectedText: "夜の帳が下りる頃、彼は歩き始めた。",
    });
    expect(text).toContain("【選択中のテキスト（第1話 プロローグ）】");
    expect(text).toContain("夜の帳が下りる頃、彼は歩き始めた。");
    expect(text).toContain("この部分について相談したいです：");
  });
});

describe("rowToUIMessage", () => {
  it("parts があればそれをそのまま使い、無ければ text パーツを合成すること", () => {
    const withParts = rowToUIMessage({
      id: "m1",
      role: "assistant",
      content: "古い内容",
      parts: [{ type: "text", text: "新しい内容", state: "done" }],
    });
    expect(withParts.parts).toEqual([
      { type: "text", text: "新しい内容", state: "done" },
    ]);

    const withoutParts = rowToUIMessage({
      id: "m2",
      role: "user",
      content: "こんにちは",
    });
    expect(withoutParts.role).toBe("user");
    expect(withoutParts.id).toBe("m2");
    expect(withoutParts.parts).toEqual([
      { type: "text", text: "こんにちは", state: "done" },
    ]);
  });
});

describe("extractChatEntities", () => {
  it("extractChatEntities が正しくPOSTリクエストを送出してエンティティを返すこと", async () => {
    const { extractChatEntities } = await import("../src/lib/services/chat.js");
    const mockEntities = {
      characters: [
        {
          name: "アリス",
          category: "主人公",
          description: "勇敢な少女",
          traits: ["金髪"],
        },
      ],
      settings: [
        { name: "魔法王国", category: "世界観", description: "魔法の国" },
      ],
    };

    mockFetch.mockResolvedValue(jsonResponse(mockEntities));

    const data = await extractChatEntities("アリスと魔法王国");

    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].name).toBe("アリス");
    expect(data.settings).toHaveLength(1);
    expect(data.settings[0].name).toBe("魔法王国");
  });
});
