import type { VectorSearchResult } from "@novel-creator/vector";

export interface PruneOptions {
  maxCharsPerItem?: number;
  minScore?: number;
  queryTerms: string[];
  topK: number;
}

export interface RrfMergeOptions {
  /** RRF 定数 k（既定 60）。大きいほど順位差の影響が緩やかになる。 */
  k?: number;
  topK?: number;
}

/**
 * Reciprocal Rank Fusion (RRF) による純粋な融合関数。
 * ベクトル順位と FTS 順位（各 1 位起点）の逆数和で並べ替える。
 * 同一 id が両リストにある場合はスコアを合算して1件にまとめる。
 * 返却 score は下流の minScore 足切りと互換にするため両者の最大値を保持し、
 * 並び順のみを RRF スコアで決める（同点時は元スコア順）。
 * pruneRanked はフォールバック・後段処理として残置する。
 */
export function rrfMerge(
  vectorHits: VectorSearchResult[],
  ftsHits: VectorSearchResult[],
  options: RrfMergeOptions = {}
): VectorSearchResult[] {
  const k = options.k ?? 60;
  const topK = options.topK ?? 10;
  const fused = new Map<
    string,
    { best: VectorSearchResult; maxScore: number; rrf: number }
  >();

  const accumulate = (hits: VectorSearchResult[]) => {
    hits.forEach((hit, index) => {
      const rank = index + 1;
      const entry = fused.get(hit.id);
      const contribution = 1 / (k + rank);
      if (entry) {
        entry.rrf += contribution;
        if (hit.score > entry.maxScore) {
          entry.best = hit;
          entry.maxScore = hit.score;
        }
      } else {
        fused.set(hit.id, {
          best: hit,
          maxScore: hit.score,
          rrf: contribution,
        });
      }
    });
  };
  accumulate(vectorHits);
  accumulate(ftsHits);

  return [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf || b.maxScore - a.maxScore)
    .slice(0, Math.max(0, topK))
    .map((entry) => ({ ...entry.best, score: entry.maxScore }));
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[\s\u3000、。,.!?！？「」『』（）()[\]{}・:：;；/／ー\-_]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

/**
 * 簡易再ランク: minScore足切り → entityId dedup → keywordOverlap再ランク → topK。
 * 純関数。入力順序に依存せずスコア順で返す。
 */
export function pruneRanked(
  cands: VectorSearchResult[],
  options: PruneOptions
): VectorSearchResult[] {
  const { topK, minScore, queryTerms, maxCharsPerItem } = options;
  const terms = queryTerms
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 2);
  const termSet = new Set(terms);

  const filtered =
    minScore === undefined
      ? [...cands]
      : cands.filter((c) => c.score >= minScore);

  const seen = new Set<string>();
  const deduped: VectorSearchResult[] = [];
  for (const c of filtered) {
    const key = c.entityId || c.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(c);
  }

  const reranked = deduped
    .map((c) => {
      let overlap = 0;
      if (termSet.size > 0) {
        const contentTokens = tokenize(c.content);
        let hits = 0;
        for (const term of termSet) {
          if (
            c.content.toLowerCase().includes(term) ||
            contentTokens.has(term)
          ) {
            hits += 1;
          }
        }
        overlap = hits / termSet.size;
      }
      const blended = c.score * 0.7 + overlap * 0.3;
      return { cand: c, blended };
    })
    .sort((a, b) => b.blended - a.blended)
    .slice(0, Math.max(0, topK))
    .map(({ cand }) => {
      if (
        maxCharsPerItem === undefined ||
        cand.content.length <= maxCharsPerItem
      ) {
        return cand;
      }
      return { ...cand, content: `${cand.content.slice(0, maxCharsPerItem)}…` };
    });

  return reranked;
}

/** RAGクエリからキーワード項を抽出する（2文字以上・最大20項）。 */
export function extractQueryTerms(query: string): string[] {
  const tokens = query
    .split(/[\s\u3000、。,.!?！？「」『』（）()[\]{}・:：;；/／ー\-_]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
    if (unique.length >= 20) {
      break;
    }
  }
  return unique;
}
