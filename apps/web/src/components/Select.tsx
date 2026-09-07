import { forwardRef, type SelectHTMLAttributes, useId } from "react";
import { ChevronDownIcon } from "./Icons.js";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

/**
 * Input / Textarea と見た目を揃えた select。
 * ラベル・エラー表示・余白・高さ・文字サイズ・フォーカスリングは Input と同じトークン。
 * ネイティブの矢印は appearance-none で消し、Combobox と同じ Chevron を
 * 同じ位置に重ねている。disabled の見た目も Select / Combobox で統一した。
 */
const BASE_FIELD_CLASS =
  "peer w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-9 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS =
  "mb-1.5 block font-medium text-foreground-secondary text-sm";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, id, label, children, ...props }, ref) => {
    const generatedId = useId().replace(/:/g, "");
    const selectId = id ?? (label ? `select-${generatedId}` : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className={LABEL_CLASS}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`${BASE_FIELD_CLASS} ${className}`}
            {...props}
          >
            {children}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted peer-disabled:opacity-50"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        </div>
        {error && <p className="mt-1 text-danger text-xs">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
