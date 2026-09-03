import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabHeader } from "../src/components/TabHeader.js";

describe("TabHeader", () => {
  it("タイトル、leftExtra、rightControls、viewModeSwitch が正しく配置されること", () => {
    render(
      <TabHeader
        title="人物一覧"
        leftExtra={<span data-testid="left-extra">折りたたみ</span>}
        rightControls={<button type="button">新規作成</button>}
        viewModeSwitch={<span data-testid="view-switch">切替スイッチ</span>}
      />
    );

    expect(screen.getByText("人物一覧")).toBeInTheDocument();
    expect(screen.getByTestId("left-extra")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新規作成" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("view-switch")).toBeInTheDocument();
  });
});
