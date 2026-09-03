interface ViewModeOption<T extends string> {
  label: string;
  value: T;
}

interface ViewModeSwitchProps<T extends string> {
  ariaLabel?: string;
  className?: string;
  onChange: (value: T) => void;
  options?: [ViewModeOption<T>, ViewModeOption<T>];
  value: T;
}

/**
 * 一覧表示モードとマークダウン編集モードを切り替える共通セグメントコントロール。
 */
export function ViewModeSwitch<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "表示モード切替",
  className = "",
}: ViewModeSwitchProps<T>) {
  const defaultOptions: [ViewModeOption<T>, ViewModeOption<T>] = [
    { label: "一覧", value: "cards" as T },
    { label: "マークダウン", value: "markdown" as T },
  ];

  const items = options ?? defaultOptions;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex shrink-0 rounded-lg border border-border bg-surface p-0.5 text-xs ${className}`}
    >
      {items.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition ${
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
