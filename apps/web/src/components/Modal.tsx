import { type ReactNode, useEffect, useRef } from "react";
import { CloseIcon } from "./Icons.js";

interface ModalProps {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  title: string;
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const isBackdropMouseDown = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isBackdropMouseDown.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isBackdropMouseDown.current && e.target === e.currentTarget) {
      onClose();
    }
    isBackdropMouseDown.current = false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col ${sizeMap[size]} overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-border-subtle border-b px-6 py-4">
          <h2 className="font-semibold text-foreground text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted transition hover:bg-surface-hover hover:text-foreground"
            aria-label="閉じる"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-border-subtle border-t px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
