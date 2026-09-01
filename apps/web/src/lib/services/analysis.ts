import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  AnalysisHistoryEntry,
  AnalysisProgress,
  AnalysisType,
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  StoryArcResult,
} from "../types.js";

/** 口調チェック・ペルソナレビューの実行オプション（すべて任意）。 */
export interface AnalysisRunOptions {
  body?: string;
  chapterId?: string;
  modelConfigId?: string | null;
  sectionId?: string;
}

/**
 * SSE ブロック（`event: <name>\ndata: <json>`）を解析する共通パーサー。
 * generate.ts のストリーム読みパターン（res.body.getReader() + TextDecoder + '\n\n' 分割 + 部分バッファ）を踏襲し、
 * `event:` 行の解析を追加している。`:` で始まるコメント行・コメントのみのブロックは無視する。
 */
async function readAnalysisSse(
  res: { body: ReadableStream | null },
  handlers: {
    progress?: (p: AnalysisProgress) => void;
    complete?: (data: { result: unknown; savedId: string | null }) => void;
    error?: (message: string) => void;
  }
): Promise<void> {
  if (!res.body) {
    throw new Error("分析結果の受信に失敗しました（接続が切断されました）");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawComplete = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // ブロック区切り '\n\n' で分割し、末尾の不完全文はバッファに残す
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        let eventName = "";
        let dataLine: string | null = null;

        for (const rawLine of block.split("\n")) {
          const line = rawLine.trim();
          // ':' で始まる行は SSE コメントとして無視
          if (!line || line.startsWith(":")) {
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim();
          }
        }

        if (!dataLine) {
          continue;
        }
        let payload: unknown;
        try {
          payload = JSON.parse(dataLine);
        } catch {
          // JSON パースエラーは無視
          continue;
        }
        const data = payload as Record<string, unknown>;

        if (eventName === "progress") {
          handlers.progress?.({
            stage: typeof data.stage === "string" ? data.stage : "",
            current: typeof data.current === "number" ? data.current : 0,
            total: typeof data.total === "number" ? data.total : 0,
          });
        } else if (eventName === "complete") {
          sawComplete = true;
          handlers.complete?.({
            result: data.result,
            savedId: typeof data.savedId === "string" ? data.savedId : null,
          });
        } else if (eventName === "error") {
          handlers.error?.(
            typeof data.message === "string"
              ? data.message
              : "分析中にエラーが発生しました"
          );
        }
        // 未知のイベント名は無視
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawComplete) {
    throw new Error("分析結果の受信に失敗しました（接続が切断されました）");
  }
}

/** 分析種別の判定ガード。RPC 推論型では string に落ちるため復元に使う。 */
function isAnalysisType(v: string): v is AnalysisType {
  return v === "story-arc" || v === "check-voice" || v === "persona-review";
}

/**
 * DB の jsonb に保存された多形 result ペイロードの判定ガード。
 * 3 種類の result（StoryArcResult / CharacterVoiceCheckResult / MultiPersonaReviewResult）
 * はいずれも JSON オブジェクト形式のため、オブジェクト性のみを検証する。
 */
function isAnalysisResult(v: unknown): v is AnalysisHistoryEntry["result"] {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * ストーリーアーク・テンション分析を実行する（SSE）。
 * complete イベントの result を解決する。
 */
export async function runStoryArcAnalysis(
  novelId: string,
  modelConfigId?: string | null,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal
): Promise<StoryArcResult> {
  const res = await apiClient.novels[":id"].generate["story-arc"].$post(
    {
      param: { id: novelId },
      json: { modelConfigId: modelConfigId || null },
    },
    { init: { signal } }
  );

  if (!res.ok) {
    throw await parseResponseError(res, "ストーリーアーク分析の開始");
  }

  let result!: StoryArcResult;
  await readAnalysisSse(res, {
    progress: onProgress,
    complete: (data) => {
      result = data.result as StoryArcResult;
    },
    error: (message) => {
      throw new Error(message);
    },
  });
  return result;
}

/**
 * キャラクター口調・一貫性チェックを実行する（SSE）。
 * complete イベントの result を解決する。
 */
export async function runVoiceCheckAnalysis(
  novelId: string,
  opts?: AnalysisRunOptions,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal
): Promise<CharacterVoiceCheckResult> {
  const res = await apiClient.novels[":id"].generate["check-voice"].$post(
    {
      param: { id: novelId },
      json: {
        sectionId: opts?.sectionId,
        body: opts?.body,
        modelConfigId: opts?.modelConfigId || null,
      },
    },
    { init: { signal } }
  );

  if (!res.ok) {
    throw await parseResponseError(res, "キャラクター口調チェックの開始");
  }

  let result!: CharacterVoiceCheckResult;
  await readAnalysisSse(res, {
    progress: onProgress,
    complete: (data) => {
      result = data.result as CharacterVoiceCheckResult;
    },
    error: (message) => {
      throw new Error(message);
    },
  });
  return result;
}

/**
 * 複数ペルソナ模擬読者レビューを実行する（SSE）。
 * complete イベントの result を解決する。
 */
export async function runPersonaReviewAnalysis(
  novelId: string,
  opts?: AnalysisRunOptions,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal
): Promise<MultiPersonaReviewResult> {
  const res = await apiClient.novels[":id"].generate["persona-review"].$post(
    {
      param: { id: novelId },
      json: {
        sectionId: opts?.sectionId,
        chapterId: opts?.chapterId,
        body: opts?.body,
        modelConfigId: opts?.modelConfigId || null,
      },
    },
    { init: { signal } }
  );

  if (!res.ok) {
    throw await parseResponseError(res, "模擬読者レビューの開始");
  }

  let result!: MultiPersonaReviewResult;
  await readAnalysisSse(res, {
    progress: onProgress,
    complete: (data) => {
      result = data.result as MultiPersonaReviewResult;
    },
    error: (message) => {
      throw new Error(message);
    },
  });
  return result;
}

/**
 * 保存済み分析結果の履歴一覧を取得する。
 * analysisType が指定されていない場合は query 自体を省略する。
 */
export async function listAnalysisResults(
  novelId: string,
  analysisType?: AnalysisType
): Promise<AnalysisHistoryEntry[]> {
  const res = await apiClient.novels[":id"]["analysis-results"].$get({
    param: { id: novelId },
    query:
      analysisType !== undefined
        ? { analysisType }
        : // zValidator('query', ...) を通るため、query 自体は必須。未指定時は空オブジェクトを渡す。
          {},
  });
  if (!res.ok) {
    throw await parseResponseError(res, "分析履歴の取得");
  }
  // result は analysisType に応じた多形 JSON（DB の jsonb）のため、RPC 推論型では JSONValue に
  // 落ちる。analysisType / result は型ガードでドメイン型へ復元し、他のフィールドは推論型を
  // そのまま使う。
  return (await res.json()).map((entry) => {
    if (!isAnalysisResult(entry.result)) {
      throw new Error(`分析結果の形式が不正です（id: ${entry.id}）`);
    }
    if (!isAnalysisType(entry.analysisType)) {
      throw new Error(`分析種別の形式が不正です（id: ${entry.id}）`);
    }
    return {
      ...entry,
      analysisType: entry.analysisType,
      result: entry.result,
      createdAt: entry.createdAt ?? new Date(0).toISOString(),
    };
  });
}

/**
 * 保存済み分析結果を削除する。
 */
export async function deleteAnalysisResult(
  novelId: string,
  resultId: string
): Promise<void> {
  const res = await apiClient.novels[":id"]["analysis-results"][
    ":resultId"
  ].$delete({
    param: { id: novelId, resultId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "分析履歴の削除");
  }
}
