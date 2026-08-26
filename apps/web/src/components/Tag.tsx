interface TagProps {
  children: string;
  className?: string;
}

export function Tag({ children, className = '' }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary-subtle-fg ${className}`}
    >
      {children}
    </span>
  );
}
