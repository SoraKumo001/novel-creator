interface SaveStatusBadgeProps {
  className?: string;
  isDirty: boolean;
  saving: boolean;
}

export function SaveStatusBadge({
  saving,
  isDirty,
  className = "",
}: SaveStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
        saving
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : isDirty
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          saving
            ? "animate-ping bg-amber-500"
            : isDirty
              ? "bg-rose-500"
              : "bg-emerald-500"
        }`}
      />
      {saving ? "保存中..." : isDirty ? "未保存" : "保存完了"}
    </span>
  );
}
