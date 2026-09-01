import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../src/context.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { novelAnalysisRouter } from '../src/routes/novels/analysis.js';
import vectorRouter from '../src/routes/vector.js';

// getServices をモック化し、解析・再インデックスサービスをスタブする。
// vi.hoisted により、モジュール評価前に初期化される。
const mockServices = vi.hoisted(() => ({
  analysis: {
    streamCheckVoice: vi.fn(),
    streamStoryArc: vi.fn(),
    streamPersonaReview: vi.fn(),
    listResults: vi.fn(),
    deleteResult: vi.fn(),
  },
  reindex: {
    reindexAll: vi.fn(),
  },
}));

vi.mock('../src/core/services.js', () => ({
  getServices: () => mockServices,
}));

const NOVEL_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

/**
 * テスト用の Hono アプリを構築する（analysis / vector ルーターをマウント）。
 */
function createTestApp() {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('env', {} as never);
    c.set('db', {} as never);
    c.set('llm', {} as never);
    c.set('embedding', {} as never);
    c.set('vectorStore', {} as never);
    await next();
  });
  app.onError(errorHandler);
  app.route('/api/novels', novelAnalysisRouter);
  app.route('/api/vector', vectorRouter);
  return app;
}

/** SSE イベント（event 名 + data パース結果） */
interface ParsedSSEEvent {
  event: string | null;
  data: unknown;
}

/**
 * レスポンスボディを ReadableStream 経由で読み取り、生テキストを返す。
 * フロントエンドと同じ「ストリームとしての読み取り」を模倣する。
 */
async function readStreamText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

/**
 * SSE 生テキストをイベントブロック（event / data 行）へ分解してパースする。
 */
function parseSSE(raw: string): ParsedSSEEvent[] {
  return raw
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event: '));
      const dataLine = lines.find((l) => l.startsWith('data: '));
      return {
        event: eventLine ? eventLine.slice('event: '.length) : null,
        data: dataLine ? JSON.parse(dataLine.slice('data: '.length)) : null,
      };
    });
}

describe('analysis SSE のワイヤ契約', () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('check-voice は progress → complete の順で event 名とペイロードを維持すること', async () => {
    // analysis.service.ts の AnalysisEvent と同一形状のイベントを流す
    mockServices.analysis.streamCheckVoice.mockImplementation(async function* () {
      yield { type: 'progress', stage: 'AIが分析中', current: 0, total: 0 };
      yield { type: 'progress', stage: '分析結果を保存中', current: 1, total: 2 };
      yield { type: 'complete', result: { ok: true }, savedId: 'result-1' };
    });

    const res = await app.request(`/api/novels/${NOVEL_ID}/generate/check-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = parseSSE(await readStreamText(res));

    // イベント順序・event 名・ペイロード形状の検証
    expect(events).toHaveLength(3);
    expect(events[0]!.event).toBe('progress');
    expect(events[0]!.data).toEqual({
      type: 'progress',
      stage: 'AIが分析中',
      current: 0,
      total: 0,
    });
    expect(events[1]!.event).toBe('progress');
    expect(events[1]!.data).toEqual({
      type: 'progress',
      stage: '分析結果を保存中',
      current: 1,
      total: 2,
    });
    expect(events[2]!.event).toBe('complete');
    expect(events[2]!.data).toEqual({
      type: 'complete',
      result: { ok: true },
      savedId: 'result-1',
    });

    // サービスにはパス・ボディの値が透過的に渡ること
    expect(mockServices.analysis.streamCheckVoice).toHaveBeenCalledWith(
      NOVEL_ID,
      undefined,
      undefined,
      undefined,
    );
  });

  it('check-voice は例外発生時に event: error / { type: error, message } を返すこと', async () => {
    mockServices.analysis.streamCheckVoice.mockImplementation(async function* () {
      yield { type: 'progress', stage: 'AIが分析中', current: 0, total: 0 };
      throw new Error('分析に失敗しました');
    });

    const res = await app.request(`/api/novels/${NOVEL_ID}/generate/check-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const events = parseSSE(await readStreamText(res));

    // 途中までのイベント + 最後に error イベントが 1 件
    expect(events).toHaveLength(2);
    expect(events[0]!.event).toBe('progress');
    expect(events[1]!.event).toBe('error');
    expect(events[1]!.data).toEqual({ type: 'error', message: '分析に失敗しました' });
  });
});

describe('vector reindex SSE のワイヤ契約', () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('reindex は progress → done の順でイベントを返すこと', async () => {
    mockServices.reindex.reindexAll.mockImplementation(
      async (_configId: unknown, onProgress: (p: unknown) => void) => {
        onProgress({ phase: 'embedding', current: 1, total: 3 });
        onProgress({ phase: 'upserting', current: 3, total: 3 });
        return { indexed: 3 };
      },
    );

    const res = await app.request('/api/vector/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = parseSSE(await readStreamText(res));

    expect(events).toHaveLength(3);
    expect(events[0]!.event).toBe('progress');
    expect(events[0]!.data).toEqual({ phase: 'embedding', current: 1, total: 3 });
    expect(events[1]!.event).toBe('progress');
    expect(events[1]!.data).toEqual({ phase: 'upserting', current: 3, total: 3 });
    // done イベントは { done: true, result } 形状を維持する
    expect(events[2]!.event).toBe('done');
    expect(events[2]!.data).toEqual({ done: true, result: { indexed: 3 } });
  });

  it('reindex は例外発生時に event: error / { error } を返すこと', async () => {
    mockServices.reindex.reindexAll.mockRejectedValue(new Error('再構築に失敗しました'));

    const res = await app.request('/api/vector/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const events = parseSSE(await readStreamText(res));

    // reindex SSE のエラーペイロードは解析系と異なる { error } 形状を維持する
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('error');
    expect(events[0]!.data).toEqual({ error: '再構築に失敗しました' });
  });
});
