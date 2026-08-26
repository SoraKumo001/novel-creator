import type { ReactNode } from 'react';
import { Nav } from './Nav.js';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Nav />
      <main className="flex-1 overflow-hidden p-6 md:p-8">{children}</main>
    </div>
  );
}
