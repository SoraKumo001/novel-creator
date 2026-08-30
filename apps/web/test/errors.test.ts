import { describe, expect, it } from 'vitest';
import { parseResponseError, toErrorMessage } from '../src/lib/errors.js';

describe('errors', () => {
  it('toErrorMessage は Error オブジェクトからメッセージを取得すること', () => {
    expect(toErrorMessage(new Error('テストエラー'))).toBe('テストエラー');
  });

  it('toErrorMessage は JSON 形式の API エラーをパースすること', () => {
    const err = new Error(JSON.stringify({ error: { message: 'APIエラーメッセージ' } }));
    expect(toErrorMessage(err)).toBe('APIエラーメッセージ');
  });

  it('parseResponseError は 502 の場合にサーバー接続エラーメッセージを返すこと', async () => {
    const res = new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    const err = await parseResponseError(res, 'AI編集');
    expect(err.message).toContain('502 Bad Gateway');
    expect(err.message).toContain(
      'バックエンドサーバー（pnpm dev）が起動しているか確認してください',
    );
  });

  it('parseResponseError は 429 の場合にレート制限エラーメッセージを返すこと', async () => {
    const res = new Response('Too Many Requests', { status: 429, statusText: 'Too Many Requests' });
    const err = await parseResponseError(res, 'AI編集');
    expect(err.message).toContain('429');
    expect(err.message).toContain('レート制限');
  });
});
