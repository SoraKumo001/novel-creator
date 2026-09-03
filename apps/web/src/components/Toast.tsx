import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CloseIcon } from "./Icons.js";

export type ToastType = "success" | "error" | "loading";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  dismissToast: (id: number) => void;
  showToast: (type: ToastType, message: string) => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;

/**
 * トースト通知の状態を管理する Provider。
 * useToast フックでアクセスする。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      if (type !== "loading") {
        setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
      }
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/**
 * トースト通知の状態にアクセスするための内部フック。
 * 公開 API は hooks/useToast.ts の useToast を使用する。
 */
export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const typeStyles: Record<ToastType, string> = {
  success:
    "border-emerald-500/30 bg-surface/95 text-emerald-600 dark:text-emerald-400 shadow-xl border backdrop-blur-md ring-1 ring-emerald-500/20",
  error:
    "border-rose-500/30 bg-surface/95 text-rose-600 dark:text-rose-400 shadow-xl border backdrop-blur-md ring-1 ring-rose-500/20",
  loading:
    "border-border bg-surface/95 text-foreground shadow-xl border backdrop-blur-md ring-1 ring-primary/20",
};

const typeIcons: Record<ToastType, ReactNode> = {
  success: (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
    </div>
  ),
  error: (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
    </div>
  ),
  loading: (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  ),
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-100 flex w-88 max-w-[calc(100vw-3rem)] flex-col gap-2.5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`fade-in slide-in-from-bottom-5 pointer-events-auto flex animate-in items-center gap-3 rounded-xl p-3.5 font-medium text-xs shadow-2xl transition-all duration-300 ${typeStyles[toast.type]}`}
        >
          {typeIcons[toast.type]}
          <div className="wrap-break-word flex-1 font-semibold text-foreground">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
            aria-label="閉じる"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
