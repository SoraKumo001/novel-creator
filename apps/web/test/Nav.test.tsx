import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Nav } from "../src/components/Nav.js";

// mock tanstack router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
    title,
  }: {
    children: ReactNode;
    to: string;
    className?: string;
    title?: string;
  }) => (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

// mock ChatContext
vi.mock("@/context/ChatContext.js", () => ({
  useChatUI: () => ({
    toggleChat: vi.fn(),
    isOpen: false,
  }),
}));

// mock useTheme
vi.mock("@/hooks/useTheme.js", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

// mock useAuth（未ログイン状態）
vi.mock("@/hooks/useAuth.js", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isAuthenticated: false,
    signOut: vi.fn(),
  }),
}));

// mock useToast
vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("Nav component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("初期状態（展開時）でロゴ名・メニューテキスト・縮小ボタンが表示されること", () => {
    render(<Nav />);

    expect(screen.getByText("Novel Creator")).toBeInTheDocument();
    expect(screen.getByText("小説一覧")).toBeInTheDocument();
    expect(screen.getByText("AI創作相談")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "メニューを縮小" })
    ).toBeInTheDocument();
  });

  it("「メニューを縮小」ボタンをクリックすると縮小状態になり、展開ボタンが表示されること", () => {
    render(<Nav />);

    const collapseButton = screen.getByRole("button", {
      name: "メニューを縮小",
    });
    fireEvent.click(collapseButton);

    // テキストが非表示になり、展開ボタンが表示される
    expect(screen.queryByText("Novel Creator")).not.toBeInTheDocument();
    expect(screen.queryByText("小説一覧")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "メニューを展開" })
    ).toBeInTheDocument();
    expect(localStorage.getItem("novel-creator:nav-collapsed")).toBe("true");
  });

  it("「メニューを展開」ボタンをクリックすると通常サイズに戻ること", () => {
    localStorage.setItem("novel-creator:nav-collapsed", "true");
    render(<Nav />);

    expect(screen.queryByText("小説一覧")).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: "メニューを展開" });
    fireEvent.click(expandButton);

    expect(screen.getByText("小説一覧")).toBeInTheDocument();
    expect(localStorage.getItem("novel-creator:nav-collapsed")).toBe("false");
  });
});
