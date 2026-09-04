import { describe, expect, it } from "vitest";
import {
  renderMarkdownWithRuby,
  renderRubyLine,
  sanitizeHtml,
} from "../src/lib/sanitize.js";

describe("sanitizeHtml", () => {
  it("ruby/rt が残存する", () => {
    const out = sanitizeHtml("<ruby>漢字<rt>かんじ</rt></ruby>");
    expect(out).toContain("<ruby>");
    expect(out).toContain("<rt>");
  });

  it("傍点 span.emphasis-dots の class が残存する", () => {
    const out = sanitizeHtml('<span class="emphasis-dots">秘密</span>');
    expect(out).toContain("emphasis-dots");
  });

  it("<script> を除去する", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert("x")</script>');
    expect(out).not.toContain("<script>");
    expect(out).toContain("ok");
  });
});

describe("renderMarkdownWithRuby", () => {
  it("marked通過後に <ruby> が残存する", () => {
    const out = renderMarkdownWithRuby("|漢字《かんじ》");
    expect(out).toContain("<ruby>");
    expect(out).toContain("<rt>かんじ</rt>");
  });

  it("傍点 span.emphasis-dots の class が残存する", () => {
    const out = renderMarkdownWithRuby("《《秘密》》");
    expect(out).toContain("emphasis-dots");
  });

  it("<script> を除去する", () => {
    const out = renderMarkdownWithRuby('本文<script>alert("x")</script>');
    expect(out).not.toContain("<script>");
    expect(out).toContain("本文");
  });

  it("《<img onerror>》 を無害化する", () => {
    const out = renderMarkdownWithRuby("《《<img src=x onerror=alert(1)>》》");
    expect(out).not.toContain("<img");
    expect(out).toContain("emphasis-dots");
  });

  it("|a《b未閉じ は <ruby> 化しない", () => {
    const out = renderMarkdownWithRuby("|a《b未閉じ");
    expect(out).not.toContain("<ruby>");
  });
});

describe("renderRubyLine", () => {
  it("ルビ行を <ruby> 化する", () => {
    const out = renderRubyLine("|漢字《かんじ》");
    expect(out).toContain("<ruby>");
    expect(out).toContain("<rt>かんじ</rt>");
  });

  it("<script> を除去する", () => {
    const out = renderRubyLine('<script>alert("x")</script>');
    expect(out).not.toContain("<script>");
  });
});
