import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", rows = 4, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block font-medium text-foreground-secondary text-sm">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-rose-500 text-xs">{error}</p>}
    </div>
  )
);

Textarea.displayName = "Textarea";
