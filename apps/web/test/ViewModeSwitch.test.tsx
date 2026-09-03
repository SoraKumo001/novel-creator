import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewModeSwitch } from "../src/components/ViewModeSwitch.js";

describe("ViewModeSwitch", () => {
  it("指定した選択肢が正しく描画され、アクティブな選択肢にスタイルが適用されること", () => {
    const onChange = vi.fn();
    render(
      <ViewModeSwitch
        value="cards"
        onChange={onChange}
        options={[
          { label: "一覧", value: "cards" },
          { label: "マークダウン", value: "markdown" },
        ]}
      />
    );

    const listBtn = screen.getByRole("button", { name: "一覧" });
    const mdBtn = screen.getByRole("button", { name: "マークダウン" });

    expect(listBtn).toBeInTheDocument();
    expect(mdBtn).toBeInTheDocument();
    expect(listBtn).toHaveClass("bg-primary");
    expect(mdBtn).toHaveClass("text-muted-foreground");
  });

  it("非アクティブな選択肢をクリックすると onChange が呼ばれること", () => {
    const onChange = vi.fn();
    render(
      <ViewModeSwitch
        value="cards"
        onChange={onChange}
        options={[
          { label: "カード", value: "cards" },
          { label: "マークダウン", value: "markdown" },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "マークダウン" }));
    expect(onChange).toHaveBeenCalledWith("markdown");
  });
});
