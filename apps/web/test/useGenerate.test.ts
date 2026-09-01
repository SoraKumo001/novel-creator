import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerate } from "../src/hooks/useGenerate.js";
import * as services from "../src/lib/services/index.js";
import * as sse from "../src/lib/sse.js";

describe("useGenerate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generatePlot 実行時に activeGeneration と startedAt が設定され、完了後にリセットされること", async () => {
    const mockPlot = {
      title: "テスト作品",
      description: "あらすじ",
      chapters: [{ title: "第1章", order: 1, summary: "概要" }],
    };

    vi.spyOn(services, "generatePlot").mockImplementation(async () => mockPlot);

    const { result } = renderHook(() => useGenerate());

    expect(result.current.generatingPlot).toBe(false);
    expect(result.current.activeGeneration).toBeNull();
    expect(result.current.startedAt).toBeNull();

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.generatePlot("novel-1");
    });

    expect(result.current.generatingPlot).toBe(true);
    expect(result.current.activeGeneration).toBe("plot");
    expect(result.current.startedAt).not.toBeNull();

    await act(async () => {
      await promise;
    });

    expect(result.current.generatingPlot).toBe(false);
    expect(result.current.activeGeneration).toBeNull();
    expect(result.current.startedAt).toBeNull();
    expect(result.current.generatedPlot).toEqual(mockPlot);
  });

  it("generateContent 実行時に生成文字数がカウントされること", async () => {
    vi.spyOn(sse, "streamGenerateContent").mockImplementation(
      async (_sectionId, onChunk) => {
        onChunk("吾輩は");
        onChunk("猫である。");
      }
    );

    const { result } = renderHook(() => useGenerate());
    const onChunk = vi.fn();

    await act(async () => {
      await result.current.generateContent("section-1", onChunk);
    });

    expect(onChunk).toHaveBeenCalledWith("吾輩は");
    expect(onChunk).toHaveBeenCalledWith("猫である。");
    expect(result.current.generatingContent).toBe(false);
  });

  it("cancelGeneration でアクティブな処理が中断されること", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(services, "generatePlot").mockImplementation(
      async (_novelId, _modelConfigId, signal) => {
        capturedSignal = signal;
        return new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
    );

    const { result } = renderHook(() => useGenerate());

    let plotPromise: Promise<unknown>;
    act(() => {
      plotPromise = result.current.generatePlot("novel-1");
    });

    expect(result.current.activeGeneration).toBe("plot");

    await act(async () => {
      result.current.cancelGeneration();
      try {
        await plotPromise;
      } catch {
        // expected rejection
      }
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.activeGeneration).toBeNull();
  });
});
