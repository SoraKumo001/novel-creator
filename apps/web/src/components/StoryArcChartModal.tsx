import { useMemo, useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { StoryArcResult } from '@/lib/types.js';

interface StoryArcChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: StoryArcResult | null;
  isLoading: boolean;
}

export function StoryArcChartModal({
  isOpen,
  onClose,
  result,
  isLoading,
}: StoryArcChartModalProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // SVG チャートの計算
  const chartMetrics = useMemo(() => {
    if (!result || result.dataPoints.length === 0) return null;
    const points = result.dataPoints;
    const width = 600;
    const height = 200;
    const padding = 30;

    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth / 2;

    // テンション座標 (0〜100 -> height〜0)
    const tensionCoords = points.map((p, idx) => {
      const x = padding + (points.length > 1 ? idx * stepX : innerWidth / 2);
      const y = padding + innerHeight - (p.tension / 100) * innerHeight;
      return { x, y, point: p };
    });

    // 感情価座標 (-100〜100 -> height〜0)
    const valenceCoords = points.map((p, idx) => {
      const x = padding + (points.length > 1 ? idx * stepX : innerWidth / 2);
      const normalized = (p.valence + 100) / 200; // 0〜1
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

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="ストーリーアーク分析中..." size="lg">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-center">
            <p className="font-semibold text-foreground">
              全章・節のドラマチック・アークを解析中...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              緊張感の起伏・感情曲線・中だるみ区間をスコアリングしています
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  if (!result) return null;

  const selectedPoint = selectedPointIndex !== null ? result.dataPoints[selectedPointIndex] : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📈 物語のテンション & 感情アーク（起伏）可視化"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 総括カード */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2 text-xs">
          <div className="font-bold text-foreground text-sm flex items-center justify-between">
            <span>📋 ストーリー構成 & テンポ評価</span>
          </div>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {result.summary}
          </p>
          {result.pacingCritique && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
              💡 <span className="font-semibold">テンポ・構成へのアドバイス:</span>{' '}
              {result.pacingCritique}
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
                {/* グリッド線・中心線 */}
                <line
                  x1={chartMetrics.padding}
                  y1={chartMetrics.padding + chartMetrics.innerHeight / 2}
                  x2={chartMetrics.width - chartMetrics.padding}
                  y2={chartMetrics.padding + chartMetrics.innerHeight / 2}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-border"
                />

                {/* テンション曲線 */}
                <path
                  d={chartMetrics.tensionPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 感情価曲線 */}
                <path
                  d={chartMetrics.valencePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* ポイント丸印 */}
                {chartMetrics.tensionCoords.map((c, idx) => {
                  const isSelected = selectedPointIndex === idx;
                  return (
                    <g
                      key={`t-${idx}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedPointIndex(idx)}
                    >
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
                    <g
                      key={`v-${idx}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedPointIndex(idx)}
                    >
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
                  onClick={() => setSelectedPointIndex(null)}
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
              <p className="text-muted-foreground leading-relaxed">
                💡 <strong className="mr-1">盛り上げ助言:</strong> {selectedPoint.advice}
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            <div className="text-xs font-semibold text-muted-foreground">節ごとのデータ一覧:</div>
            {result.dataPoints.map((pt, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPointIndex(idx)}
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
      </div>
    </Modal>
  );
}
