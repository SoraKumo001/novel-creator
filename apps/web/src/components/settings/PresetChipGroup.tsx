interface PresetChipGroupProps<T extends { label: string }> {
  onSelect: (preset: T) => void;
  presets: readonly T[];
  summary?: string;
}

export function PresetChipGroup<T extends { label: string }>({
  onSelect,
  presets,
  summary = "プリセットから素早く入力",
}: PresetChipGroupProps<T>) {
  return (
    <details className="rounded-lg border border-border bg-surface-raised/40 px-3 py-2">
      <summary className="cursor-pointer select-none font-medium text-foreground-secondary text-xs marker:text-muted hover:text-foreground">
        {summary}
      </summary>
      <div className="flex flex-wrap gap-1.5 pt-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelect(preset)}
            className="rounded-md border border-border bg-surface-raised px-2 py-1 text-foreground text-xs transition hover:border-primary hover:text-primary"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </details>
  );
}
