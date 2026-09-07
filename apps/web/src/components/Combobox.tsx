import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "./Icons.js";
import { Input } from "./Input.js";

interface ComboboxProps {
  disabled?: boolean;
  error?: string;
  hint?: string;
  id?: string;
  label?: string;
  name?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  value: string;
}

/**
 * 自由入力できるテキスト入力と候補パネルを組み合わせた簡易コンボボックス。
 * 入力欄の見た目 (余白・高さ・文字サイズ・フォーカスリング) は Input そのまま。
 * ラベル・エラー表示は Input と同じトークンで描画し、開閉 Chevron は
 * Select と同じ位置・大きさに揃えている。
 * 候補は絞り込まず全件表示する。取得前 (options が空) は通常の入力欄になる。
 */
export function Combobox({
  disabled = false,
  error,
  hint,
  id,
  label,
  name,
  onChange,
  options,
  placeholder,
  required,
  value,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId().replace(/:/g, "");
  const inputId = id ?? `combobox-${generatedId}`;
  const listboxId = `combobox-listbox-${generatedId}`;
  const hasOptions = options.length > 0;

  useEffect(() => {
    if (!(open && hasOptions && !disabled)) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, hasOptions, disabled]);

  function handleToggle() {
    if (disabled) {
      return;
    }
    setOpen((prev) => !prev);
  }

  function handleSelect(option: string) {
    onChange(option);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block font-medium text-foreground-secondary text-sm"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          name={name}
          autoComplete="off"
          className={hasOptions ? "pr-9" : undefined}
        />
        {hasOptions && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label={open ? "候補一覧を閉じる" : "候補一覧を開く"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
        {open && hasOptions && !disabled && (
          <div className="absolute inset-x-0 top-full z-10 mt-1">
            <div
              id={listboxId}
              role="listbox"
              aria-label="取得したモデル一覧"
              className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
            >
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  onClick={() => handleSelect(option)}
                  className={`block w-full break-all px-3 py-1.5 text-left text-foreground text-sm transition hover:bg-surface-hover ${
                    option === value ? "bg-surface-raised font-medium" : ""
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-danger text-xs">{error}</p>}
      {hint && hasOptions && <p className="mt-1 text-muted text-xs">{hint}</p>}
    </div>
  );
}
