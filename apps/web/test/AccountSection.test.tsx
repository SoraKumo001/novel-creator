import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSection } from "../src/components/settings/AccountSection.js";

const updateProfileMock = vi.fn();

const authMock = {
  user: {
    id: "user-1",
    name: "テスト太郎",
    email: "test@example.com",
    role: "member" as const,
    avatarUrl: null,
  },
  isAdmin: false,
  isAuthenticated: true,
  updateProfile: updateProfileMock,
};

vi.mock("@/hooks/useAuth.js", () => ({
  useAuth: () => authMock,
}));

vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("AccountSection component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = {
      id: "user-1",
      name: "テスト太郎",
      email: "test@example.com",
      role: "member",
      avatarUrl: null,
    };
    authMock.isAdmin = false;
  });

  it("初期表示でメールアドレス、権限バッジ、現在のユーザー名が表示されること", () => {
    render(<AccountSection />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("👤 一般ユーザー")).toBeInTheDocument();
    const input = screen.getByLabelText
      ? screen.getByRole("textbox")
      : screen.getByDisplayValue("テスト太郎");
    expect(input).toHaveValue("テスト太郎");
  });

  it("ユーザー名を変更して保存ボタンを押すと updateProfile が呼び出されること", async () => {
    updateProfileMock.mockResolvedValue(undefined);
    render(<AccountSection />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "新しい名前" } });

    const saveButton = screen.getByRole("button", { name: "変更を保存" });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith("新しい名前");
    });
  });

  it("変更前と同じ名前または空文字の場合は保存ボタンが無効化されること", () => {
    render(<AccountSection />);

    const saveButton = screen.getByRole("button", { name: "変更を保存" });
    // 初期状態は変更なしなので無効
    expect(saveButton).toBeDisabled();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    expect(saveButton).toBeDisabled();
  });

  it("リセットボタンをクリックすると元の名前に戻ること", () => {
    render(<AccountSection />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "変更途中の名前" } });
    expect(input).toHaveValue("変更途中の名前");

    const resetButton = screen.getByRole("button", { name: "リセット" });
    fireEvent.click(resetButton);

    expect(input).toHaveValue("テスト太郎");
  });
});
