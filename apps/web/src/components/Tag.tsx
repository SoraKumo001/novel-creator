interface TagProps {
  children: string;
  className?: string;
}

export function Tag({ children, className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary-subtle px-2.5 py-0.5 font-medium text-primary-subtle-fg text-xs ${className}`}
    >
      {children}
    </span>
  );
}
