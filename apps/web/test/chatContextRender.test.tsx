import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatProvider,
  useChatStreamingState,
  useChatUI,
} from "../src/context/ChatContext.js";

/**
 * ChatContext 分割（低頻度 ChatUIContext / 高頻度 ChatStreamingContext）の構造テスト。
 * 実際の ChatProvider + 制御可能なモックストリームでストリーミングを再現し、
 * 片方の context 更新がもう片方の consumer の再レンダーを引き起こさないことを
 * render 回数で検証する。
 */

let uiRenderCount = 0;
let streamingRenderCount = 0;

function UIProbe() {
  useChatUI();
  uiRenderCount += 1;
  return null;
}

function StreamingProbe() {
  const { streamingContent } = useChatStreamingState();
  streamingRenderCount += 1;
  return <div data-testid="streaming-content">{streamingContent}</div>;
}

const mockFetch = vi.fn();

let queryClient: QueryClient;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const createdSession = {
  id: "sess-1",
  novelId: "novel-1",
  title: "テストセッション",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** チャンクをテスト側のタイミングで送れるよう制御できる UI Message Stream */
interface ControlledStream {
  closeStream: (id: string) => void;
  sendTextDelta: (id: string, delta: string) => void;
  sendTextStart: (id: string) => void;
  stream: ReadableStream<Uint8Array>;
}

function createControlledStream(): ControlledStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  const sendEvent = (event: unknown) => {
    controller?.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  return {
    stream,
    sendTextStart: (id) => sendEvent({ type: "text-start", id }),
    sendTextDelta: (id, delta) => sendEvent({ type: "text-delta", id, delta }),
    closeStream: (id) => {
      sendEvent({ type: "text-end", id });
      sendEvent({ type: "finish", finishReason: "stop" });
      controller?.close();
    },
  };
}

/** モックが /api/chat への応答として返すストリーム本体（テストごとに差し替える） */
let chatStream: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>({
  start() {},
});

let sessionsFetchCount = 0;
let releaseSessionsFetch: ((response: Response) => void) | null = null;

/** finish 後の refreshSessions による一覧再取得をテストの検証完了まで保留する */
function deferredSessionsResponse(): Promise<Response> {
  return new Promise((resolve) => {
    releaseSessionsFetch = (response) => {
      releaseSessionsFetch = null;
      resolve(response);
    };
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  uiRenderCount = 0;
  streamingRenderCount = 0;
  sessionsFetchCount = 0;
  releaseSessionsFetch = null;
  chatStream = new ReadableStream<Uint8Array>({ start() {} });

  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/chat")) {
        return new Response(chatStream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      if (url.includes("/api/chat/sessions")) {
        if (method === "POST") {
          return jsonResponse(createdSession, 201);
        }
        sessionsFetchCount += 1;
        if (sessionsFetchCount === 1) {
          return jsonResponse([]);
        }
        if (sessionsFetchCount === 2) {
          return jsonResponse([createdSession]);
        }
        // 3回目以降（finish 後の invalidate）はゲートして保留にする
        return deferredSessionsResponse();
      }
      return jsonResponse([]);
    }
  );

  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
});

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChatProvider>
          {children}
          <UIProbe />
          <StreamingProbe />
        </ChatProvider>
      </QueryClientProvider>
    );
  };
}

function useTestHooks() {
  return { ui: useChatUI(), streaming: useChatStreamingState() };
}

describe("ChatContext split render counts", () => {
  it("ストリーミング中の高頻度 context の更新では低頻度 context の consumer は再レンダーしないこと", async () => {
    const stream = createControlledStream();
    chatStream = stream.stream;

    const { result } = renderHook(useTestHooks, { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.ui.loadingSessions).toBe(false));

    // 事前準備: セッションを作成し、送信時に自動作成が走らないようにする
    await act(async () => {
      await result.current.ui.createSession("novel-1", "テストセッション");
    });
    await waitFor(() => expect(result.current.ui.sessions).toHaveLength(1));

    const uiBaseline = uiRenderCount;
    const streamingBaseline = streamingRenderCount;

    // 送信開始（ストリームは未クローズのまま）
    let sendPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      sendPromise = result.current.streaming.sendMessage(
        "ストリーミングのテスト"
      );
    });

    // ユーザーメッセージ追加 → 高頻度側のみ再レンダー
    await waitFor(() =>
      expect(streamingRenderCount).toBeGreaterThan(streamingBaseline)
    );
    expect(uiRenderCount).toBe(uiBaseline);

    // 1チャンク目
    await act(async () => {
      stream.sendTextStart("t1");
      stream.sendTextDelta("t1", "こん");
    });
    await waitFor(() =>
      expect(result.current.streaming.streamingContent).toContain("こん")
    );
    const afterFirstChunk = streamingRenderCount;
    expect(afterFirstChunk).toBeGreaterThan(streamingBaseline);
    expect(uiRenderCount).toBe(uiBaseline);

    // 2チャンク目
    await act(async () => {
      stream.sendTextDelta("t1", "、世界");
    });
    await waitFor(() =>
      expect(result.current.streaming.streamingContent).toContain("、世界")
    );
    expect(streamingRenderCount).toBeGreaterThan(afterFirstChunk);
    expect(uiRenderCount).toBe(uiBaseline);

    // ストリーム完了（finish 後の sessions 再取得はゲート中 → 低頻度に影響しない）
    await act(async () => {
      stream.closeStream("t1");
    });
    await waitFor(() =>
      expect(result.current.streaming.isStreaming).toBe(false)
    );
    await sendPromise;

    expect(uiRenderCount).toBe(uiBaseline);

    // 後片付け: ゲートしていた sessions 再取得を解放する
    await act(async () => {
      releaseSessionsFetch?.(jsonResponse([createdSession]));
    });
    await waitFor(() => expect(releaseSessionsFetch).toBeNull());
  });

  it("低頻度 context の更新では高頻度 context の consumer は再レンダーしないこと", async () => {
    const { result } = renderHook(useTestHooks, { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.ui.loadingSessions).toBe(false));

    const uiBaseline = uiRenderCount;
    const streamingBaseline = streamingRenderCount;

    // 低頻度操作: チャットの開閉（isOpen のみが変わり messages には触れない）
    await act(async () => {
      result.current.ui.toggleChat();
    });
    await waitFor(() => expect(result.current.ui.isOpen).toBe(true));

    // 低頻度側は更新され、高頻度側は再レンダーしない
    expect(uiRenderCount).toBeGreaterThan(uiBaseline);
    expect(streamingRenderCount).toBe(streamingBaseline);

    // 閉じても同様
    const uiBeforeClose = uiRenderCount;
    await act(async () => {
      result.current.ui.toggleChat();
    });
    await waitFor(() => expect(result.current.ui.isOpen).toBe(false));
    expect(uiRenderCount).toBeGreaterThan(uiBeforeClose);
    expect(streamingRenderCount).toBe(streamingBaseline);
  });
});
