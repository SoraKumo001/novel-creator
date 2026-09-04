import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonacoEditor } from "../src/routes/novels/_components/-MonacoEditor.js";

vi.mock("@/hooks/useTheme.js", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

interface CapturedProps {
  options?: {
    find?: unknown;
    fontSize?: number;
    minimap?: { enabled?: boolean };
    wordWrap?: string;
  };
}

const captured: CapturedProps[] = [];

vi.mock("@monaco-editor/react", () => ({
  Editor: (props: CapturedProps) => {
    captured.push(props);
    return <div data-testid="stub-editor" />;
  },
}));

beforeEach(() => {
  captured.length = 0;
});

describe("MonacoEditor 最小オプション", () => {
  it("既定で従来表示（fontSize 15・wordWrap on・minimap off）を維持すること", async () => {
    render(<MonacoEditor value="a" onChange={() => {}} />);
    await screen.findByTestId("stub-editor");
    const options = captured.at(-1)?.options;
    expect(options?.fontSize).toBe(15);
    expect(options?.wordWrap).toBe("on");
    expect(options?.minimap?.enabled).toBe(false);
  });

  it("標準の検索ウィジェット設定（find）が有効化されていること", async () => {
    render(<MonacoEditor value="a" onChange={() => {}} />);
    await screen.findByTestId("stub-editor");
    expect(captured.at(-1)?.options?.find).toBeDefined();
  });

  it("fontSize・wordWrap props が options に反映されること", async () => {
    render(
      <MonacoEditor
        value="a"
        onChange={() => {}}
        fontSize={18}
        wordWrap="off"
      />
    );
    await screen.findByTestId("stub-editor");
    const options = captured.at(-1)?.options;
    expect(options?.fontSize).toBe(18);
    expect(options?.wordWrap).toBe("off");
  });
});
