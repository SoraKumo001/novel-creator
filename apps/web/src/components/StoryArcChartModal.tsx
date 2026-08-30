import { useMemo, useRef, useState } from 'react';
import { HistoryViewBanner } from './HistoryViewBanner.js';
import { AnalysisHistoryPanel } from './AnalysisHistoryPanel.js';
import { AnalysisProgressPanel } from './AnalysisProgressPanel.js';
import { Button } from './Button.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { Modal } from './Modal.js';
import type { AnalysisProgress } from '@/hooks/useAnalysis.js';
import type { AnalysisHistoryEntry, StoryArcResult } from '@/lib/types.js';

interface StoryArcChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 表示する結果。null のときは進捗 / 履歴のみ表示する。 */
  result: StoryArcResult | null;
  /** useAnalysis の進捗。実行中なら progress/stage を表示する。 */
  progress: AnalysisProgress | null;
  /** この分析が実行中かどうか (useAnalysis.running === 'story-arc')。 */
  running: boolean;
  /** 直近の実行で発生したエラーメッセージ。キャンセル時は呼び出し側で null にする。 */
  error?: string | null;
  /** 現在表示している結果が保存された履歴かどうか。 */
  isHistoryView?: boolean;
  /** 履歴として表示している結果の保存日時 (ISO)。 */
  viewedAt?: string | null;
  /** 履歴から結果を選択したとき。 */
  onSelectHistory: (entry: AnalysisHistoryEntry) => void;
  /** 「再実行」「新しく実行」が押されたとき。 */
  onRerun: () => void;
  /** キャンセル要求。useAnalysis.cancel を呼ぶ。 */
  onCancel: () => void;
  /** 履歴リストの再取得トリガー。新規実行完了時にインクリメントする。 */
  historyRefreshKey?: number;
  /** 作品ID (履歴取得に利用)。 */
  novelId: string;
}

export function StoryArcChartModal({
  isOpen,
  onClose,
  result,
  progress,
  running,
  error,
  isHistoryView = false,
  viewedAt = null,
  onSelectHistory,
  onRerun,
  onCancel,
  historyRefreshKey = 0,
  novelId,
}: StoryArcChartModalProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  // 解析開始時刻。running に遷移したタイミングで記録する。
  const startTimeRef = useRef<number>(Date.now());
  const wasRunningRef = useRef(false);
  if (running && !wasRunningRef.current) {
    startTimeRef.current = Date.now();
  }
  wasRunningRef.current = running;

  // SVG チャートの計算
  const chartMetrics = useMemo<ChartMetrics | null>(() => {
    if (!result || result.dataPoints.length === 0) return null;
    const points = result.dataPoints;
    const width = 600;
    const height = 200;
    const padding = 30;

    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth / 2;

    const tensionCoords = points.map((p, idx) => {
      const x = padding + (points.length > 1 ? idx * stepX : innerWidth / 2);
      const y = padding + innerHeight - (p.tension / 100) * innerHeight;
      return { x, y, point: p };
    });

    const valenceCoords = points.map((p, idx) => {
      const x = padding + (points.length > 1 ? idx * stepX : innerWidth / 2);
      const normalized = (p.valence + 100) / 200;
      const y = padding + innerHeight - normalized * innerHeight;
      return { x, y, point: p };
    });

    const tensionPath = tensionCoords.reduce(
      (acc, c, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`,
      '',
    );

    const valencePath = valenceCoords.reduce(
      (acc, c, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`,
      '',
    );

    return {
      width,
      height,
      padding,
      innerHeight,
      tensionCoords,
      valenceCoords,
      tensionPath,
      valencePath,
    };
  }, [result]);

  const title = running
    ? 'ストーリーアーク分析中…'
    : '📈 物語のテンション & 感情アーク（起伏）可視化';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        running ? (
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">分析結果は自動保存されます</span>
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        )
      }
    >
      {running ? (
        <AnalysisProgressPanel
          progress={progress}
          startedAt={startTimeRef.current}
          onCancel={onCancel}
        />
      ) : (
        <div className="space-y-4">
          {/* エラー表示 */}
          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-subtle-fg flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={onRerun}>
                再試行
              </Button>
            </div>
          )}

          {/* 履歴閲覧バッジ */}
          {isHistoryView && result && <HistoryViewBanner createdAt={viewedAt ?? undefined} />}

          {/* 結果 */}
          {result && (
            <ResultBody
              result={result}
              chartMetrics={chartMetrics}
              selectedPointIndex={selectedPointIndex}
              onSelectPoint={setSelectedPointIndex}
            />
          )}

          {/* 履歴 */}
          <AnalysisHistoryPanel
            novelId={novelId}
            analysisType="story-arc"
            isOpen={isOpen}
            refreshKey={historyRefreshKey}
            onSelect={onSelectHistory}
            onRerun={onRerun}
          />
        </div>
      )}
    </Modal>
  );
}

interface Coord {
  x: number;
  y: number;
  point: StoryArcResult['dataPoints'][number];
}

interface ChartMetrics {
  width: number;
  height: number;
  padding: number;
  innerHeight: number;
  tensionCoords: Coord[];
  valenceCoords: Coord[];
  tensionPath: string;
  valencePath: string;
}

function ResultBody({
  result,
  chartMetrics,
  selectedPointIndex,
  onSelectPoint,
}: {
  result: StoryArcResult;
  chartMetrics: ChartMetrics | null;
  selectedPointIndex: number | null;
  onSelectPoint: (idx: number | null) => void;
}) {
  const selectedPoint = selectedPointIndex !== null ? result.dataPoints[selectedPointIndex] : null;

  return (
    <>
      {/* 総括カード */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2 text-xs">
        <div className="font-bold text-foreground text-sm flex items-center justify-between">
          <span>📋 ストーリー構成 & テンポ評価</span>
        </div>
        <MarkdownText compact content={result.summary} className="text-muted-foreground" />
        {result.pacingCritique && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
            💡 <span className="font-semibold">テンポ・構成へのアドバイス:</span>{' '}
            <MarkdownText
              compact
              content={result.pacingCritique}
              className="text-amber-700 dark:text-amber-300"
            />
          </div>
        )}
      </div>

      {/* SVG 折れ線グラフ */}
      {chartMetrics && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-rose-500">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                緊張感・サスペンス (Tension)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-blue-500">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                感情価 (Valence: 絶望 ⇄ 歓喜)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              各ポイントをクリックして詳細を確認
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartMetrics.width} ${chartMetrics.height}`}
              className="w-full h-56 select-none"
            >
              <line
                x1={chartMetrics.padding}
                y1={chartMetrics.padding + chartMetrics.innerHeight / 2}
                x2={chartMetrics.width - chartMetrics.padding}
                y2={chartMetrics.padding + chartMetrics.innerHeight / 2}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-border"
              />
              <path
                d={chartMetrics.tensionPath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={chartMetrics.valencePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chartMetrics.tensionCoords.map((c, idx) => {
                const isSelected = selectedPointIndex === idx;
                return (
                  <g key={`t-${idx}`} className="cursor-pointer" onClick={() => onSelectPoint(idx)}>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isSelected ? 6 : 4}
                      fill="#f43f5e"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-all hover:scale-125"
                    />
                  </g>
                );
              })}
              {chartMetrics.valenceCoords.map((c, idx) => {
                const isSelected = selectedPointIndex === idx;
                return (
                  <g key={`v-${idx}`} className="cursor-pointer" onClick={() => onSelectPoint(idx)}>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isSelected ? 6 : 4}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-all hover:scale-125"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* 選択節の詳細 または 全節リスト */}
      {selectedPoint ? (
        <div className="rounded-xl border border-primary bg-primary/5 p-4 text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">
              📌 {selectedPoint.chapterTitle} - {selectedPoint.sectionTitle}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-rose-500/10 text-rose-600 px-2 py-0.5 font-bold">
                緊張感: {selectedPoint.tension} / 100
              </span>
              <span className="rounded bg-blue-500/10 text-blue-600 px-2 py-0.5 font-bold">
                感情価:{' '}
                {selectedPoint.valence > 0 ? `+${selectedPoint.valence}` : selectedPoint.valence}
              </span>
              <button
                type="button"
                onClick={() => onSelectPoint(null)}
                className="text-xs text-muted-foreground hover:text-foreground ml-2"
              >
                ✕ 選択解除
              </button>
            </div>
          </div>
          <p className="text-foreground leading-relaxed">
            <strong className="text-primary mr-1">劇的出来事:</strong> {selectedPoint.keyEvent}
          </p>
          {selectedPoint.advice && (
            <div className="text-muted-foreground leading-relaxed">
              💡 <strong className="mr-1">盛り上げ助言:</strong>{' '}
              <MarkdownText
                compact
                content={selectedPoint.advice}
                className="text-muted-foreground"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          <div className="text-xs font-semibold text-muted-foreground">節ごとのデータ一覧:</div>
          {result.dataPoints.map((pt, idx) => (
            <div
              key={idx}
              onClick={() => onSelectPoint(idx)}
              className="rounded-lg border border-border bg-surface p-2.5 text-xs flex items-center justify-between hover:border-primary hover:bg-surface-raised cursor-pointer transition"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">
                  {pt.chapterTitle} - {pt.sectionTitle}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{pt.keyEvent}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-rose-600 font-bold text-xs">緊張 {pt.tension}</span>
                <span className="text-blue-600 font-bold text-xs">
                  感情 {pt.valence > 0 ? `+${pt.valence}` : pt.valence}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
