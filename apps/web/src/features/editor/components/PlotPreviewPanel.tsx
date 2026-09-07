import { Button } from "@/components/Button.js";
import type { GeneratedPlot } from "@/lib/types.js";

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
    selectedPlotIndices.size === plotPreview.chapters.length &&
    plotPreview.chapters.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-primary/40 bg-surface-raised p-5 shadow-sm">
      <div className="flex items-center justify-between border-border border-b pb-3">
        <div>
          <h3 className="font-bold text-base text-foreground">
            生成されたプロット案
          </h3>
          <p className="mt-0.5 text-muted-foreground text-xs">
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

      <div className="flex items-center justify-between px-1 text-muted-foreground text-xs">
        <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
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
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                isChecked
                  ? "border-primary bg-primary/5 shadow-xs dark:bg-primary/10"
                  : "border-border bg-surface opacity-70 hover:bg-surface-hover/50"
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
                <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                  {ch.summary}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
