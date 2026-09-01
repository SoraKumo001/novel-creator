import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSessionList } from "../src/components/chat/ChatSessionList.js";
import type { ChatSession } from "../src/lib/types.js";

function makeSession(overrides: Partial<ChatSession>): ChatSession {
  return {
    id: "sess-1",
    novelId: "novel-1",
    title: "プロット相談",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

const sessions: ChatSession[] = [
  makeSession({ id: "sess-1", title: "プロット相談" }),
  makeSession({ id: "sess-2", title: "キャラクター設定" }),
  makeSession({ id: "sess-3", title: "世界観構築" }),
];

function renderList(
  overrides: Partial<Parameters<typeof ChatSessionList>[0]> = {}
) {
  const props = {
    sessions,
    currentSessionId: null,
    currentNovelTitle: "テスト小説",
    pinnedIds: new Set<string>(),
    onTogglePin: vi.fn(),
    onSelectSession: vi.fn(),
    onSaveTitle: vi.fn().mockResolvedValue(true),
    onDeleteSession: vi.fn().mockResolvedValue(undefined),
    onStartNewChat: vi.fn(),
    ...overrides,
  };
  render(<ChatSessionList {...props} />);
  return props;
}

describe("ChatSessionList", () => {
  it("セッションのタイトルが表示されること", () => {
    renderList();

    expect(screen.getByText("プロット相談")).toBeInTheDocument();
    expect(screen.getByText("キャラクター設定")).toBeInTheDocument();
    expect(screen.getByText("世界観構築")).toBeInTheDocument();
  });

  it("現在のセッションが「開いています」と表示されること", () => {
    renderList({ currentSessionId: "sess-2" });

    expect(screen.getByText("開いています")).toBeInTheDocument();
  });

  it("検索でタイトルが絞り込まれること", () => {
    renderList();

    fireEvent.change(screen.getByPlaceholderText("履歴を検索..."), {
      target: { value: "キャラ" },
    });

    expect(screen.getByText("キャラクター設定")).toBeInTheDocument();
    expect(screen.queryByText("プロット相談")).not.toBeInTheDocument();
    expect(screen.queryByText("世界観構築")).not.toBeInTheDocument();
  });

  it("onSaveTitle が false を返すと編集モードが開いたままになること", async () => {
    const onSaveTitle = vi.fn().mockResolvedValue(false);
    renderList({ onSaveTitle });

    // 編集ボタンを押して編集モードへ（最初のセッション）
    fireEvent.click(screen.getAllByTitle("タイトル変更")[0]);
    expect(screen.getByDisplayValue("プロット相談")).toBeInTheDocument();

    // 保存を押す
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() =>
      expect(onSaveTitle).toHaveBeenCalledWith("sess-1", "プロット相談")
    );

    // 失敗時は編集入力が残っている
    expect(screen.getByDisplayValue("プロット相談")).toBeInTheDocument();
  });

  it("onSaveTitle が true を返すと編集モードが閉じること", async () => {
    const onSaveTitle = vi.fn().mockResolvedValue(true);
    renderList({ onSaveTitle });

    fireEvent.click(screen.getAllByTitle("タイトル変更")[0]);
    expect(screen.getByDisplayValue("プロット相談")).toBeInTheDocument();

    fireEvent.click(screen.getByText("保存"));

    await waitFor(() =>
      expect(onSaveTitle).toHaveBeenCalledWith("sess-1", "プロット相談")
    );

    // 成功時は編集入力が消え、タイトル表示に戻る
    expect(screen.queryByDisplayValue("プロット相談")).not.toBeInTheDocument();
    expect(screen.getByText("プロット相談")).toBeInTheDocument();
  });

  it("削除フローで確認後に onDeleteSession が呼ばれること", async () => {
    const onDeleteSession = vi.fn().mockResolvedValue(undefined);
    renderList({ onDeleteSession });

    fireEvent.click(screen.getAllByTitle("削除")[0]);
    expect(
      screen.getByText("この相談履歴を削除しますか？")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("削除する"));

    await waitFor(() => expect(onDeleteSession).toHaveBeenCalledWith("sess-1"));
  });

  it("ピン留めトグルで onTogglePin が id 付きで呼ばれること", () => {
    const onTogglePin = vi.fn();
    renderList({ onTogglePin });

    fireEvent.click(screen.getAllByTitle("上部にピン留め")[0]);

    expect(onTogglePin).toHaveBeenCalledWith("sess-1");
  });
});
