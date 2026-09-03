import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../src/components/Badge.js";

describe("Badge", () => {
  it("指定したバリアントとテキスト、アイコンが表示されること", () => {
    render(
      <Badge variant="rose" icon={<span data-testid="badge-icon">⚠️</span>}>
        視点ブレ
      </Badge>
    );

    expect(screen.getByText("視点ブレ")).toBeInTheDocument();
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
  });

  it("各バリアントのクラスが適用されること", () => {
    const { container } = render(<Badge variant="emerald">回収済</Badge>);
    const badgeEl = container.firstChild as HTMLElement;
    expect(badgeEl.className).toContain("border-emerald-500/30");
  });
});
