import type { ReactNode } from "react";

interface FormCheckRowProps {
  checked: boolean;
  className?: string;
  hint?: ReactNode;
  id: string;
  inputClassName?: string;
  label: ReactNode;
  labelClassName?: string;
  onChange: (checked: boolean) => void;
}

/**
 * label/hint付きの1行チェックボックス。
 * 既定の見た目は ConfigFormModal のデフォルト設定行と同一。
 * 移行先の既存スタイルを保つ場合は className / inputClassName /
 * labelClassName で上書きする（見た目の regression を避けるため）。
 */
export function FormCheckRow({
  checked,
  className = "flex items-center gap-2",
  hint,
  id,
  inputClassName = "h-4 w-4 rounded border-border text-primary focus:ring-primary",
  label,
  labelClassName = "select-none text-foreground text-sm",
  onChange,
}: FormCheckRowProps) {
  if (!hint) {
    return (
      <div className={className}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={inputClassName}
        />
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={inputClassName}
      />
      <div className="min-w-0">
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
        <p className="mt-0.5 text-muted text-xs">{hint}</p>
      </div>
    </div>
  );
}
