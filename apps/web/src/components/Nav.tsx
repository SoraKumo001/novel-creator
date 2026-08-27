import { Link } from '@tanstack/react-router';
import { useChat } from '@/hooks/useChat.js';
import { useTheme, type ThemeMode } from '@/hooks/useTheme.js';

export function Nav() {
  const { toggleChat, isOpen } = useChat();
  const { theme, setTheme } = useTheme();

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'ライト', icon: '☀️' },
    { mode: 'dark', label: 'ダーク', icon: '🌙' },
    { mode: 'system', label: '自動', icon: '💻' },
  ];

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="p-4">
        <Link to="/" className="flex items-center gap-2 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Novel Creator</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <Link
          to="/novels"
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-secondary transition hover:bg-surface-hover hover:text-foreground"
          activeProps={{
            className: 'bg-primary-subtle text-primary-subtle-fg',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 text-muted transition group-hover:text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          小説一覧
        </Link>

        <Link
          to="/backup"
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-secondary transition hover:bg-surface-hover hover:text-foreground"
          activeProps={{
            className: 'bg-primary-subtle text-primary-subtle-fg',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 text-muted transition group-hover:text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.5 16.556 18.375 12 18.375s-8.25-1.875-8.25-4.375v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          バックアップ
        </Link>

        <button
          type="button"
          onClick={toggleChat}
          className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            isOpen
              ? 'bg-primary-subtle text-primary-subtle-fg'
              : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`h-5 w-5 transition ${
              isOpen ? 'text-primary' : 'text-muted group-hover:text-foreground'
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          AI創作相談
        </button>
      </nav>

      {/* テーマ切り替え & フッター */}
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised p-1 text-xs">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setTheme(opt.mode)}
                className={`flex flex-1 items-center justify-center gap-1 rounded py-1 transition ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={`${opt.label}モードに切り替え`}
              >
                <span>{opt.icon}</span>
                <span className="text-[11px]">{opt.label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-1 text-[11px] text-muted-foreground">
          <p>物語を創り、世界を紡ぐ。</p>
        </div>
      </div>
    </aside>
  );
}
