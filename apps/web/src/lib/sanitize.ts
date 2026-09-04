import { parseRubyToHtml } from "@novel-creator/shared";
import DOMPurify, { type Config } from "dompurify";
import { marked } from "marked";

/**
 * Markdownプレビュー共通サニタイズ設定。
 * - ruby/rt/rp を明示的に許可（ルビが消えないようにする）
 * - 傍点用 span.emphasis-dots が消えないように class を許可
 */
export const SANITIZE_CONFIG: Config = {
  ADD_TAGS: ["ruby", "rt", "rp"],
  ADD_ATTR: ["class"],
};

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, SANITIZE_CONFIG) as string;
}

// 方針: ルビ記法は marked.parse 後の HTML に掛ける（前処理だと生成した <ruby> が marked にエスケープされるため）。
/** 横=GFMフルレンダ用: marked HTML化後にルビ変換→サニタイズする。 */
export function renderMarkdownWithRuby(content: string): string {
  const raw = marked.parse(content, { async: false, breaks: true }) as string;
  return sanitizeHtml(parseRubyToHtml(raw));
}

/** 縦=プレーン行分割用: 1行のルビ変換→サニタイズする。 */
export function renderRubyLine(line: string): string {
  return sanitizeHtml(parseRubyToHtml(line));
}
