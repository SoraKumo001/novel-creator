import { describe, expect, it } from 'vitest';
import { parseRubyToHtml, stripRuby } from '../src/ruby.js';

describe('ruby and emphasis utilities', () => {
  it('パイプ付きルビをHTMLに変換できること', () => {
    const input = '|東雲《しののめ》の空が白む。';
    const expected = '<ruby>東雲<rt>しののめ</rt></ruby>の空が白む。';
    expect(parseRubyToHtml(input)).toBe(expected);
  });

  it('全角パイプ付きルビをHTMLに変換できること', () => {
    const input = '｜瑠璃《ラピス》色の瞳';
    const expected = '<ruby>瑠璃<rt>ラピス</rt></ruby>色の瞳';
    expect(parseRubyToHtml(input)).toBe(expected);
  });

  it('パイプなしの漢字直後ルビをHTMLに変換できること', () => {
    const input = '勇者《ゆうしゃ》が剣を構えた。';
    const expected = '<ruby>勇者<rt>ゆうしゃ</rt></ruby>が剣を構えた。';
    expect(parseRubyToHtml(input)).toBe(expected);
  });

  it('傍点記法をHTMLに変換できること', () => {
    const input = 'これは《《絶対秘密》》だ。';
    const expected = 'これは<span class="emphasis-dots">絶対秘密</span>だ。';
    expect(parseRubyToHtml(input)).toBe(expected);
  });

  it('ルビ記法を除去してプレーンテキストを取得できること', () => {
    const input = '|東雲《しののめ》の空。勇者《ゆうしゃ》は《《覚悟》》を決めた。';
    const expected = '東雲の空。勇者は覚悟を決めた。';
    expect(stripRuby(input)).toBe(expected);
  });
});
