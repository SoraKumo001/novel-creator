import { describe, expect, it } from "vitest";
import {
  STYLE_GUIDE_SNIPPETS,
  STYLE_GUIDE_TEMPLATES,
} from "../src/styleGuideTemplates.js";

describe("styleGuideTemplates", () => {
  it("フルテンプレートが定義されており必須プロパティを持つこと", () => {
    expect(STYLE_GUIDE_TEMPLATES.length).toBeGreaterThan(0);
    for (const tmpl of STYLE_GUIDE_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.content).toBeTruthy();
      expect(tmpl.content).toContain("# ");
    }
  });

  it("スニペットが各カテゴリに定義されていること", () => {
    expect(STYLE_GUIDE_SNIPPETS.length).toBeGreaterThan(0);
    const categories = new Set(STYLE_GUIDE_SNIPPETS.map((s) => s.category));
    expect(categories.has("viewpoint")).toBe(true);
    expect(categories.has("tone")).toBe(true);
    expect(categories.has("rules")).toBe(true);
    expect(categories.has("ng")).toBe(true);
    expect(categories.has("direction")).toBe(true);

    for (const snp of STYLE_GUIDE_SNIPPETS) {
      expect(snp.id).toBeTruthy();
      expect(snp.name).toBeTruthy();
      expect(snp.categoryLabel).toBeTruthy();
      expect(snp.content).toBeTruthy();
    }
  });
});
