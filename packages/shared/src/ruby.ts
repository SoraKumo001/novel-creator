/**
 * ルビ・傍点記法のパースおよびHTML変換ユーティリティ
 *
 * 対応記法:
 * 1. |漢字《かんじ》 または ｜漢字《かんじ》 -> <ruby>漢字<rt>かんじ</rt></ruby>
 * 2. [一-龥々ヶ]+《かんじ》 (パイプなし漢字連続) -> <ruby>漢字<rt>かんじ</rt></ruby>
 * 3. 《《傍点》》 -> <span class="emphasis-dots">傍点</span>
 */

// 漢字にマッチする正規表現（CJK統合漢字・々・ヶ・etc）
const KANJI_REGEX =
  /([\u4E00-\u9FFF\u3005\u3006\u303B\u30F6]+)《([^》\r\n]+)》/g;
// パイプ付きルビ（任意の文字列に対応）
const PIPED_RUBY_REGEX = /[|｜]([^|｜《\r\n]+)《([^》\r\n]+)》/g;
// 傍点（《《テキスト》》）
const EMPHASIS_REGEX = /《《([^》\r\n]+)》》/g;

/**
 * ルビ・傍点記法をHTMLに変換します
 */
export function parseRubyToHtml(text: string): string {
  if (!text) {
    return "";
  }

  let html = text;

  // 1. 傍点を先に変換（二重山括弧のため）
  html = html.replace(
    EMPHASIS_REGEX,
    (_match, content: string) =>
      `<span class="emphasis-dots">${escapeHtml(content)}</span>`
  );

  // 2. パイプ付きルビの変換
  html = html.replace(
    PIPED_RUBY_REGEX,
    (_match, rb: string, rt: string) =>
      `<ruby>${escapeHtml(rb)}<rt>${escapeHtml(rt)}</rt></ruby>`
  );

  // 3. 漢字直後のルビの変換
  html = html.replace(
    KANJI_REGEX,
    (_match, rb: string, rt: string) =>
      `<ruby>${escapeHtml(rb)}<rt>${escapeHtml(rt)}</rt></ruby>`
  );

  return html;
}

/**
 * ルビや傍点の記法を除去してプレーンテキスト（本文のみ）にします
 */
export function stripRuby(text: string): string {
  if (!text) {
    return "";
  }

  return text
    .replace(EMPHASIS_REGEX, "$1")
    .replace(PIPED_RUBY_REGEX, "$1")
    .replace(KANJI_REGEX, "$1");
}

/**
 * 簡易HTMLエスケープ
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
