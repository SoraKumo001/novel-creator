import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { parseEnv } from '@novel-creator/shared/env';

describe('Embedding Configs API', () => {
  const env = parseEnv();
  const context = createContext(env);
  const app = createApp(context);

  it('GET /api/embedding-configs - 一覧を取得できること', async () => {
    const res = await app.request('/api/embedding-configs');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST /api/embedding-configs - 新しい埋め込み設定を作成できること', async () => {
    const res = await app.request('/api/embedding-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Gemini Embedding',
        provider: 'google',
        modelId: 'gemini-embedding-001',
        dimensions: 768,
        apiKey: 'AIzaFakeKey12345678',
        description: 'テスト用Gemini埋め込み',
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe('Test Gemini Embedding');
    expect(data.provider).toBe('google');
    expect(data.dimensions).toBe(768);
    expect(data.hasApiKey).toBe(true);
    expect(data.apiKeyMasked).toContain('AIza');

    // クリーンアップ
    if (data.id) {
      await app.request(`/api/embedding-configs/${data.id}`, { method: 'DELETE' });
    }
  });
});
