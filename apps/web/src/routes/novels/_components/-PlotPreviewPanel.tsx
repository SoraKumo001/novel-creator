import { Button } from '@/components/Button.js';
import type { GeneratedPlot } from '@/lib/types.js';

export function PlotPreviewPanel({
  plotPreview,
  selectedPlotIndices,
  onToggleAll,
  onToggleIndex,
  onDiscard,
  onApply,
}: {
  plotPreview: GeneratedPlot;
  selectedPlotIndices: Set<number>;
  onToggleAll: (checked: boolean) => void;
  onToggleIndex: (index: number) => void;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const allSelected =
    selectedPlotIndices.size === plotPreview.chapters.length && plotPreview.chapters.length > 0;

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-raised p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="font-bold text-foreground text-base">生成されたプロット案</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            チェックを入れた章を一括で章立て一覧に反映します。
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onDiscard}>
            破棄
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onApply}
            disabled={selectedPlotIndices.size === 0}
          >
            選択した {selectedPlotIndices.size} 章を適用
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onToggleAll(e.target.checked)}
            className="rounded text-primary focus:ring-primary"
          />
          すべて選択 / 解除
        </label>
        <span>合計 {plotPreview.chapters.length} 章</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plotPreview.chapters.map((ch, idx) => {
          const isChecked = selectedPlotIndices.has(idx);
          return (
            <label
              key={idx}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                isChecked
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                  : 'border-border bg-surface hover:bg-surface-hover/50 opacity-70'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleIndex(idx)}
                className="mt-0.5 rounded text-primary focus:ring-primary"
              />
              <div className="text-sm">
                <span className="font-semibold text-foreground">
                  第 {ch.order} 章: {ch.title}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ch.summary}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
