import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStreaming } from "../src/hooks/useChatStreaming.js";
import * as services from "../src/lib/services/index.js";

vi.mock("../src/lib/services/index.js", () => ({
  createChatSession: vi.fn(),
  deleteChatSession: vi.fn(),
  updateChatSession: vi.fn(),
}));

const createSessionMock = vi.mocked(services.createChatSession);
const updateSessionMock = vi.mocked(services.updateChatSession);

const NOVEL_ID = "novel-1";
const SESSION_ID = "sess-1";
const novelIdRef = { current: NOVEL_ID };

/** AI SDK の UI Message Stream（SSE）形式のレスポンスボディを組み立てる */
function sseResponse(...chunks: unknown[]): Response {
  const body =
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function successStream(): Response {
  return sseResponse(
    { type: "start-step" },
    {
      data: { maxSteps: 8, phase: "start", step: 0 },
      transient: true,
      type: "data-progress",
    },
    { type: "text-start", id: "0" },
    { type: "text-delta", id: "0", delta: "こんにちは、" },
    { type: "text-delta", id: "0", delta: "世界！" },
    { type: "text-end", id: "0" },
    { type: "finish", finishReason: "stop" }
  );
}

describe("useChatStreaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    createSessionMock.mockResolvedValue({
      createdAt: null,
      id: SESSION_ID,
      novelId: NOVEL_ID,
      title: "新しい相談",
      updatedAt: null,
    });
    updateSessionMock.mockResolvedValue({
      createdAt: null,
      id: SESSION_ID,
      novelId: NOVEL_ID,
      title: "こんにちは、世界！",
      updatedAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ストリーミング成功時にメッセージが確定し、セッション作成・タイトル保存・一覧更新が行われること", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successStream());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useChatStreaming({
        refreshSessions: vi.fn(),
        selectedNovelIdRef: novelIdRef,
      })
    );

    await act(async () => {
      await result.current.sendMessage("こんにちは");
    });

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.anything());
    expect(updateSessionMock).toHaveBeenCalledWith(SESSION_ID, {
      title: "こんにちは、世界！",
    });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();

    const assistants = result.current.messages.filter(
      (m) => m.role === "assistant"
    );
    expect(assistants).toHaveLength(1);
    expect(assistants[0].content).toBe("こんにちは、世界！");
  });

  it("ストリーミング途中のエラーが error として公開されること", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(
          { type: "start-step" },
          { type: "text-start", id: "0" },
          { type: "text-delta", id: "0", delta: "途中まで" },
          { type: "error", errorText: "ストリーム中に接続が切断されました" }
        )
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useChatStreaming({
        refreshSessions: vi.fn(),
        selectedNovelIdRef: novelIdRef,
      })
    );

    await act(async () => {
      await result.current.sendMessage("こんにちは");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("ストリーム中に接続が切断されました");
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it("ストリーム完了後のセッションタイトル保存失敗が error として公開されること", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successStream());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    updateSessionMock.mockRejectedValue(
      new Error("タイトルの保存に失敗しました")
    );

    const { result } = renderHook(() =>
      useChatStreaming({
        refreshSessions: vi.fn(),
        selectedNovelIdRef: novelIdRef,
      })
    );

    await act(async () => {
      await result.current.sendMessage("こんにちは");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("タイトルの保存に失敗しました");
    });
  });

  it("メッセージキャッシュ保存の失敗がログ出力され error として公開されること", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successStream());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // jsdom では sessionStorage インスタンスへの spy が効かないため、
    // Storage.prototype を介してセッションストレージ書き込みだけ失敗させる。
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (key, value) {
        if (this === window.sessionStorage) {
          throw new Error("QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useChatStreaming({
        refreshSessions: vi.fn(),
        selectedNovelIdRef: novelIdRef,
      })
    );

    await act(async () => {
      await result.current.sendMessage("こんにちは");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("QuotaExceededError");
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(setItemSpy).toHaveBeenCalled();
  });
});
