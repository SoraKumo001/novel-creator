import type { AnalysisStreamEvent } from "./analysis-types.js";

/** LLM 応答待ち中にハートビート進行イベントを流す間隔（ミリ秒）。 */
const HEARTBEAT_INTERVAL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * LLM 呼び出しをハートビートで包む。
 * Promise.race により LLM 応答待ちの間も 10 秒ごとに
 * 不定長の progress イベントを送り、SSE 接続がアイドルにならないようにする。
 * LLM promise の rejection はそのまま呼び出し元へ伝播する。
 */
export async function* runWithHeartbeat<T>(
  llmPromise: Promise<T>
): AsyncGenerator<AnalysisStreamEvent, T, undefined> {
  type RaceOutcome<R> = { beat: true } | { beat: false; value: R };

  // 消費されない rejection による unhandled rejection を防止する。
  llmPromise.catch(() => {});

  const settled: Promise<RaceOutcome<T>> = (async (): Promise<
    RaceOutcome<T>
  > => {
    const value = await llmPromise;
    return { beat: false, value };
  })();
  const beat: Promise<RaceOutcome<T>> = (async (): Promise<RaceOutcome<T>> => {
    await sleep(HEARTBEAT_INTERVAL_MS);
    return { beat: true };
  })();

  let outcome = await Promise.race([settled, beat]);
  while (outcome.beat) {
    yield { current: 0, stage: "AIが分析中", total: 0, type: "progress" };
    outcome = await Promise.race([settled, beat]);
  }

  return outcome.value;
}
