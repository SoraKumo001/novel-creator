import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chapters, customPrompts, llmConfigs, novels, sections } from '@novel-creator/db';

import type { AppContext } from '../src/context.js';

// ---- モック準備 ----

// RAG 検索をスタブ（inlineAssist / proofreadContent が import しているモジュール）
vi.mock('../src/rag.js', () => ({
  searchContext: vi.fn(),
  upsertEntityEmbedding: vi.fn(),
}));

// streamText のみモック化し、プロンプト組立（inlineAssistPrompt 等）は実物を使う
vi.mock('@novel-creator/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@novel-creator/llm')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

import { streamText } from '@novel-creator/llm';
import { GenerateDomainService } from '../src/core/generate.service.js';
import type { ServiceContext } from '../src/core/types.js';
import { searchContext } from '../src/rag.js';

const mockStreamText = vi.mocked(streamText);
const mockSearchContext = vi.mocked(searchContext);

// ---- センチネル（モック渡しの確認用） ----

const LLM_SENTINEL = { __kind: 'llm' } as unknown;
const EMBEDDING_SENTINEL = { __kind: 'embedding' } as unknown;
const VECTOR_STORE_SENTINEL = { __kind: 'vectorStore' } as unknown;
const ENV_SENTINEL = { __kind: 'env' } as unknown;

// ---- フィクスチャ ----

const NOVEL_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '44444444-4444-4444-8444-444444444444';
const SECTION_ID = '33333333-3333-4333-8333-333333333333';

const baseRows = {
  sections: [{ id: SECTION_ID, chapterId: CHAPTER_ID, title: '節1', summary: '節のあらすじ' }],
  chapters: [{ id: CHAPTER_ID, novelId: NOVEL_ID, title: '章1' }],
  novels: [{ id: NOVEL_ID, title: '小説1', styleGuide: '文体ガイド' }],
  customPrompts: [],
  // llmConfigs を空にして resolveLLMModel が ctx.llm（センチネル）へフォールバックするようにする
  llmConfigs: [],
};

type MockTables = {
  sections?: unknown[];
  chapters?: unknown[];
  novels?: unknown[];
  customPrompts?: unknown[];
  llmConfigs?: unknown[];
};

/** テーブル参照で振り分けるモック DB を構築する */
function createMockDb(rows: MockTables) {
  const byTable = new Map<unknown, unknown[]>([
    [sections, rows.sections ?? []],
    [chapters, rows.chapters ?? []],
    [novels, rows.novels ?? []],
    [customPrompts, rows.customPrompts ?? []],
    [llmConfigs, rows.llmConfigs ?? []],
  ]);
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => ({
        where: vi.fn().mockResolvedValue(byTable.get(table) ?? []),
      })),
    })),
  };
}

function createService(db: unknown) {
  const ctx = {
    db,
    llm: LLM_SENTINEL,
    embedding: EMBEDDING_SENTINEL,
    vectorStore: VECTOR_STORE_SENTINEL,
    env: ENV_SENTINEL,
  } as unknown as ServiceContext;
  return new GenerateDomainService(ctx);
}

// ---- ストリーム制御ヘルパ ----

/** マイクロタスク一式を流すためのヘルパ */
const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * テスト用のゲート。open() するまで await で進行を止められる。
 */
function createGate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, wait: promise };
}

type StreamAction = { gate?: Promise<void>; emit?: string; fail?: unknown };

/**
 * 指定されたアクション列に従ってチャンクを流す（または失敗する）ストリーム。
 * gate を指定すると、open されるまでそのアクションへ進まない。
 */
async function* scriptedStream(actions: StreamAction[]): AsyncGenerator<string> {
  for (const action of actions) {
    if (action.gate) await action.gate;
    if (action.fail !== undefined) throw action.fail;
    if (action.emit !== undefined) yield action.emit;
  }
}

/** 複数バリアント時のプロンプトに含まれるバリエーション方針（案1〜案3） */
const VARIANT_MARKERS = [
  '【バリエーション方針 案1】',
  '【バリエーション方針 案2】',
  '【バリエーション方針 案3】',
] as const;

/**
 * プロンプト中のバリエーション方針からバリアント番号を判別し、対応するスクリプトを返す。
 * キーは 0 始まりのバリアントインデックス。
 */
function registerVariantScripts(scripts: Record<number, AsyncGenerator<string>>) {
  mockStreamText.mockImplementation((_model, prompt) => {
    const index = VARIANT_MARKERS.findIndex((marker) => prompt.includes(marker));
    const script = scripts[index];
    if (!script) {
      throw new Error(
        `予期しないプロンプトです（バリアント ${index + 1}）: ${prompt.slice(0, 60)}`,
      );
    }
    return script;
  });
}

async function collect(iter: AsyncIterable<{ text: string; variant: number }>) {
  const out: Array<{ text: string; variant: number }> = [];
  for await (const chunk of iter) {
    out.push(chunk);
  }
  return out;
}

// ---- テスト ----

describe('GenerateDomainService.inlineAssist', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchContext.mockResolvedValue({
      characters: ['キャラAの説明'],
      settings: ['設定Bの説明'],
    });
  });

  describe('単一バリアント', () => {
    it('variantCount 未指定では variant: 0 のチャンクを順序通りに返すこと', async () => {
      mockStreamText.mockImplementation(() =>
        scriptedStream([{ emit: '書き' }, { emit: '出し' }, { emit: '結果' }]),
      );
      const service = createService(createMockDb(baseRows));

      const chunks = await collect(
        service.inlineAssist(SECTION_ID, { selectedText: '対象テキスト', action: 'expand' }),
      );

      expect(chunks).toEqual([
        { text: '書き', variant: 0 },
        { text: '出し', variant: 0 },
        { text: '結果', variant: 0 },
      ]);
      expect(mockStreamText).toHaveBeenCalledTimes(1);
      // 単一生成のプロンプトにはバリエーション方針が含まれない
      expect(mockStreamText.mock.calls[0]?.[1]).not.toContain('【バリエーション方針');
    });

    it('RAG 検索とプロンプト組立に節・章・小説の文脈が反映されること', async () => {
      mockStreamText.mockImplementation(() => scriptedStream([{ emit: '結果' }]));
      const service = createService(createMockDb(baseRows));

      await collect(
        service.inlineAssist(SECTION_ID, {
          selectedText: '選択範囲',
          action: 'emotional',
          surroundingText: '前後の文脈',
        }),
      );

      // RAG への渡し方: 選択テキストをクエリにして novel スコープで検索する
      expect(mockSearchContext).toHaveBeenCalledWith(
        VECTOR_STORE_SENTINEL,
        EMBEDDING_SENTINEL,
        NOVEL_ID,
        { query: '選択範囲' },
        ENV_SENTINEL,
      );
      // モデルは resolveLLMModel のフォールバック（ctx.llm）が渡る
      expect(mockStreamText.mock.calls[0]?.[0]).toBe(LLM_SENTINEL);

      const prompt = mockStreamText.mock.calls[0]?.[1] ?? '';
      expect(prompt).toContain('小説1'); // novelTitle
      expect(prompt).toContain('文体ガイド'); // styleGuide
      expect(prompt).toContain('キャラAの説明'); // characters（RAG 結果）
      expect(prompt).toContain('前後の文脈'); // surroundingText
      expect(prompt).toContain('選択範囲'); // selectedText
      // 現行挙動: 非テンプレートのプロンプトには settings は含まれない
      //（settings は customTemplate 経由でのみプロンプトへ反映される）
      expect(prompt).not.toContain('設定Bの説明');
    });
  });

  describe('複数バリアントの並列マージ', () => {
    it('バリアントのストリームがインターリーブしても到着順・内容が保たれること', async () => {
      const gateA1 = createGate();
      const gateA2 = createGate();
      const gateB1 = createGate();
      const gateB2 = createGate();
      const gateC1 = createGate();
      registerVariantScripts({
        0: scriptedStream([
          { gate: gateA1.wait, emit: 'A1' },
          { gate: gateA2.wait, emit: 'A2' },
        ]),
        1: scriptedStream([
          { gate: gateB1.wait, emit: 'B1' },
          { gate: gateB2.wait, emit: 'B2' },
        ]),
        2: scriptedStream([{ gate: gateC1.wait, emit: 'C1' }]),
      });
      const service = createService(createMockDb(baseRows));

      const iter = service.inlineAssist(SECTION_ID, {
        selectedText: '対象',
        action: 'expand',
        variantCount: 3,
      });

      // ゲートを開く順序で到着順を制御する
      gateA1.open();
      expect(await iter.next()).toEqual({ value: { text: 'A1', variant: 0 }, done: false });
      gateB1.open();
      expect(await iter.next()).toEqual({ value: { text: 'B1', variant: 1 }, done: false });
      gateA2.open();
      expect(await iter.next()).toEqual({ value: { text: 'A2', variant: 0 }, done: false });
      gateC1.open();
      expect(await iter.next()).toEqual({ value: { text: 'C1', variant: 2 }, done: false });
      gateB2.open();
      expect(await iter.next()).toEqual({ value: { text: 'B2', variant: 1 }, done: false });

      // 全バリアント完了後のみストリームが終了する
      expect((await iter.next()).done).toBe(true);

      expect(mockStreamText).toHaveBeenCalledTimes(3);
      // プロンプトはバリアントごとに方針（案1〜案3）が使い分けられる
      expect(mockStreamText.mock.calls[0]?.[1]).toContain('【バリエーション方針 案1】');
      expect(mockStreamText.mock.calls[1]?.[1]).toContain('【バリエーション方針 案2】');
      expect(mockStreamText.mock.calls[2]?.[1]).toContain('【バリエーション方針 案3】');
    });

    it('先に完了したバリアントがあっても、全バリアント完了後にストリームが終了すること', async () => {
      const gateB1 = createGate();
      registerVariantScripts({
        0: scriptedStream([{ emit: 'A1' }]), // 即完了
        1: scriptedStream([{ gate: gateB1.wait, emit: 'B1' }]),
      });
      const service = createService(createMockDb(baseRows));

      const iter = service.inlineAssist(SECTION_ID, {
        selectedText: '対象',
        action: 'expand',
        variantCount: 2,
      });

      expect(await iter.next()).toEqual({ value: { text: 'A1', variant: 0 }, done: false });

      // バリアント1（案2）が未完了のうちはストリームが終了しない
      const pending = iter.next();
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await flushAsync();
      expect(settled).toBe(false);

      gateB1.open();
      expect(await pending).toEqual({ value: { text: 'B1', variant: 1 }, done: false });
      expect((await iter.next()).done).toBe(true);
    });

    it('一部バリアントがエラーになるとストリーム全体がそのエラーで reject すること（現行挙動）', async () => {
      const gateB1 = createGate();
      const failure = new Error('variant 1 でエラー');
      registerVariantScripts({
        0: scriptedStream([{ fail: failure }]),
        1: scriptedStream([{ gate: gateB1.wait, emit: 'B1' }]),
      });
      const service = createService(createMockDb(baseRows));

      const iter = service.inlineAssist(SECTION_ID, {
        selectedText: '対象',
        action: 'expand',
        variantCount: 2,
      });

      await expect(iter.next()).rejects.toBe(failure);
      // 両バリアントのストリームは開始済み（ジェネレータ本体は最初の next() で走る）
      expect(mockStreamText).toHaveBeenCalledTimes(2);

      // 現行挙動では残りバリアントの結果は消費されない（タスク自体はキャンセルされずに
      // バックグラウンドで走り続けるため、ゲートを開けても未処理エラーにはならない）
      gateB1.open();
      await flushAsync();
    });

    it('エラー以前に到着したチャンクは先に取りり出せてから reject すること（現行挙動）', async () => {
      const gateA2 = createGate();
      const gateB1 = createGate();
      const failure = new Error('variant 1 でエラー');
      registerVariantScripts({
        0: scriptedStream([{ emit: 'A1' }, { gate: gateA2.wait, fail: failure }]),
        1: scriptedStream([{ gate: gateB1.wait, emit: 'B1' }]),
      });
      const service = createService(createMockDb(baseRows));

      const iter = service.inlineAssist(SECTION_ID, {
        selectedText: '対象',
        action: 'expand',
        variantCount: 2,
      });

      // エラーは到着順の1項目として扱われるため、先に到着したチャンクは取りり出せる
      expect(await iter.next()).toEqual({ value: { text: 'A1', variant: 0 }, done: false });
      gateB1.open();
      expect(await iter.next()).toEqual({ value: { text: 'B1', variant: 1 }, done: false });
      gateA2.open();
      await expect(iter.next()).rejects.toBe(failure);
    });

    it('消費側が break で早期終了してもエラーにならず、後続チャンクは破棄されること（現行挙動）', async () => {
      const gateA2 = createGate();
      const gateB1 = createGate();
      registerVariantScripts({
        0: scriptedStream([{ emit: 'A1' }, { gate: gateA2.wait, emit: 'A2' }]),
        1: scriptedStream([{ gate: gateB1.wait, emit: 'B1' }]),
      });
      const service = createService(createMockDb(baseRows));

      const received: Array<{ text: string; variant: number }> = [];
      for await (const chunk of service.inlineAssist(SECTION_ID, {
        selectedText: '対象',
        action: 'expand',
        variantCount: 2,
      })) {
        received.push(chunk);
        break; // 早期終了
      }

      expect(received).toEqual([{ text: 'A1', variant: 0 }]);

      // バックグラウンドタスクはキャンセルされず最後まで走る。
      // 未処理 rejection が発生しないことを確認しつつ後始末する。
      gateA2.open();
      gateB1.open();
      await flushAsync();
    });
  });
});

// ---- SSE ワイヤ契約（sections ルート × sseStream） ----

const mockServices = vi.hoisted(() => ({
  generate: {
    inlineAssist: vi.fn(),
  },
}));

vi.mock('../src/core/services.js', () => ({
  getServices: () => mockServices,
}));

import sectionsRouter from '../src/routes/sections.js';

function createSseTestApp() {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('env', {} as never);
    c.set('db', {} as never);
    c.set('llm', {} as never);
    c.set('embedding', {} as never);
    c.set('vectorStore', {} as never);
    await next();
  });
  app.route('/api/sections', sectionsRouter);
  return app;
}

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

describe('inline-assist SSE のワイヤ契約', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('data 行のみで { text, variant } を返し、全チャンク後に { done: true } を返すこと', async () => {
    mockServices.generate.inlineAssist.mockImplementation(async function* () {
      yield { text: 'A1', variant: 0 };
      yield { text: 'B1', variant: 1 };
    });

    const app = createSseTestApp();
    const res = await app.request(`/api/sections/${SECTION_ID}/generate/inline-assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedText: '対象', action: 'expand', variantCount: 2 }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const raw = await readStreamText(res);
    const dataLines = raw
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice('data: '.length));

    // チャンクは text / variant 付きで、最後に done イベントが1件
    expect(dataLines).toEqual([
      '{"text":"A1","variant":0}',
      '{"text":"B1","variant":1}',
      '{"done":true}',
    ]);
    // inline-assist の SSE は event 名を使わない（data 行のみ）
    expect(raw).not.toContain('event:');

    // ルートからサービスへの受け渡し（SSE 契約の入力側）
    expect(mockServices.generate.inlineAssist).toHaveBeenCalledWith(
      SECTION_ID,
      expect.objectContaining({ selectedText: '対象', action: 'expand', variantCount: 2 }),
    );
  });
});
