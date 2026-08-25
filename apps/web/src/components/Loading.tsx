interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export function Loading({ message, fullScreen = false, size = 'md' }: LoadingProps) {
  const spinner = (
    <div
      className={`${sizeMap[size]} animate-spin rounded-full border-indigo-600 border-t-transparent dark:border-indigo-400`}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        {spinner}
        {message && <p className="mt-4 text-sm text-slate-200">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {spinner}
      {message && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
    </div>
  );
}
