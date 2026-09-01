/**
 * 複数の AsyncIterable を並列に消費し、生成されたアイテムを到着順にマージする純粋ユーティリティ。
 *
 * 挙動仕様（generate.service.ts の inlineAssist にあった自作マージキューと同一）:
 * - すべてのソースはマージ結果が最初に pull された時点で同時に走り始める。
 * - アイテムは到着順（内部キューに入った順）で取りり出せる。
 * - あるソースがエラーで失敗した場合、そのエラーは到着順の 1 項目としてキューに入り、
 *   先頭に到達した時点でマージ結果から再スローされる。
 *   - エラーより前に到着したアイテムは先に取りり出せる。
 *   - エラー後も残りのソースはキャンセルされないが、その後のアイテムが消費されることはない。
 * - マージはすべてのソースが完了するまで終了しない。
 * - 消費側が途中で break（return()）した場合、残りのソースはそのまま走り続け、
 *   以降のアイテムは破棄される（未処理の rejection は発生しない）。
 */
export async function* mergeAsyncIterables<T>(
  sources: readonly AsyncIterable<T>[]
): AsyncGenerator<T> {
  if (sources.length === 0) {
    return;
  }

  type MergeItem = { value: T } | { error: unknown } | null;
  const queue: MergeItem[] = [];
  let resolveNext: (() => void) | null = null;
  let activeTasks = sources.length;

  const pushItem = (item: MergeItem) => {
    queue.push(item);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  for (const source of sources) {
    void (async () => {
      try {
        for await (const value of source) {
          pushItem({ value });
        }
      } catch (err) {
        pushItem({ error: err });
      } finally {
        activeTasks--;
        if (activeTasks === 0) {
          pushItem(null); // 終了シグナル
        }
      }
    })();
  }

  while (true) {
    if (queue.length === 0) {
      await new Promise<void>((r) => {
        resolveNext = r;
      });
    }

    const item = queue.shift();
    if (item === null) {
      break;
    }
    if (item && "error" in item) {
      throw item.error;
    }
    if (item && "value" in item) {
      yield item.value;
    }
  }
}
