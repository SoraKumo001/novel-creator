import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { parseEnv } from '@novel-creator/shared/env';

describe('Custom Prompts API', () => {
  const env = parseEnv();
  const context = createContext(env);
  const app = createApp(context);

  it('GET /api/custom-prompts - 一覧を取得できること（プリセット自動生成含む）', async () => {
    const res = await app.request('/api/custom-prompts');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('POST /api/custom-prompts - 新規プロンプトを作成、更新、削除できること', async () => {
    // 1. 作成
    const createRes = await app.request('/api/custom-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テスト用緊迫感アップ',
        description: 'テスト用の推敲プロンプト',
        icon: '⚡',
        category: 'inline',
        userPrompt: '以下のテキストを緊迫感重視で書き換えてください: {selectedText}',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe('テスト用緊迫感アップ');
    expect(created.icon).toBe('⚡');

    // 2. 詳細取得
    const getRes = await app.request(`/api/custom-prompts/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(created.id);

    // 3. 更新
    const updateRes = await app.request(`/api/custom-prompts/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テスト用緊迫感アップ（更新版）',
        icon: '🔥',
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('テスト用緊迫感アップ（更新版）');
    expect(updated.icon).toBe('🔥');

    // 4. 削除
    const deleteRes = await app.request(`/api/custom-prompts/${created.id}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);

    // 削除確認
    const checkRes = await app.request(`/api/custom-prompts/${created.id}`);
    expect(checkRes.status).toBe(404);
  });
});
