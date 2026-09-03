import { forwardRef, type TextareaHTMLAttributes, useId } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", rows = 4, id, ...props }, ref) => {
    const generatedId = useId().replace(/:/g, "");
    const textareaId = id ?? (label ? `textarea-${generatedId}` : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block font-medium text-foreground-secondary text-sm"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-danger text-xs">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
