import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkdownDraft } from "../src/hooks/useMarkdownDraft.js";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useMarkdownDraft", () => {
  it("ドラフトと保存済み内容が同一の場合はバナー非表示（hasDraft=false）になること", () => {
    const key = "draft:same";
    localStorage.setItem(key, "本文");
    const { result } = renderHook(() =>
      useMarkdownDraft({ storageKey: key, currentContent: "本文" })
    );

    act(() => {
      result.current.checkDraft();
    });

    expect(result.current.draftContent).toBe("本文");
    expect(result.current.hasDraft).toBe(false);
  });

  it("ドラフトと保存済み内容が異なる場合はバナー表示（hasDraft=true）になること", () => {
    const key = "draft:diff";
    localStorage.setItem(key, "下書きの続き");
    const { result } = renderHook(() =>
      useMarkdownDraft({ storageKey: key, currentContent: "本文" })
    );

    act(() => {
      result.current.checkDraft();
    });

    expect(result.current.hasDraft).toBe(true);
  });

  it("currentContent 未指定時は従来通り draft!==null で判定すること", () => {
    const key = "draft:legacy";
    localStorage.setItem(key, "本文");
    const { result } = renderHook(() => useMarkdownDraft({ storageKey: key }));

    act(() => {
      result.current.checkDraft();
    });

    expect(result.current.hasDraft).toBe(true);
  });

  it("Quota 溢れ時はエラー返却＋コールバック通知し、以降の保存を抑止すること", () => {
    const key = "draft:quota";
    const onQuotaExceeded = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownDraft({ storageKey: key, debounceMs: 10, onQuotaExceeded })
    );
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    act(() => {
      result.current.saveDraft("x");
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.draftError).toContain("保存容量");
    expect(onQuotaExceeded).toHaveBeenCalledTimes(1);

    // 保存抑止: 2 回目の saveDraft では setItem が呼ばれない
    setItemSpy.mockClear();
    act(() => {
      result.current.saveDraft("y");
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    // clearDraft でリセット後は保存が再開される
    act(() => {
      result.current.clearDraft();
    });
    expect(result.current.draftError).toBeNull();
    act(() => {
      result.current.saveDraft("z");
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });

  it("Quota 以外のエラーは従来通り無視し、保存抑止しないこと", () => {
    const key = "draft:other-error";
    const onQuotaExceeded = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownDraft({ storageKey: key, debounceMs: 10, onQuotaExceeded })
    );
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockImplementationOnce(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    act(() => {
      result.current.saveDraft("x");
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.draftError).toBeNull();
    expect(onQuotaExceeded).not.toHaveBeenCalled();

    // 抑止されていないため次回も保存を試みる
    act(() => {
      result.current.saveDraft("y");
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(setItemSpy).toHaveBeenCalledTimes(2);
  });
});
