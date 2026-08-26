import { useEffect, type ReactNode } from 'react';
import { useMatches } from '@tanstack/react-router';
import { Nav } from './Nav.js';
import { ChatDrawer } from './chat/ChatDrawer.js';
import { ChatFloatingButton } from './chat/ChatFloatingButton.js';
import { useChat } from '@/hooks/useChat.js';

interface LayoutProps {
  children: ReactNode;
}

function NovelRouteSync() {
  const matches = useMatches();
  const { setSelectedNovelId, selectedNovelId } = useChat();

  useEffect(() => {
    let currentNovelId: string | null = null;
    for (const match of matches) {
      const params = match.params as Record<string, string | undefined>;
      if (params && typeof params.novelId === 'string' && params.novelId) {
        currentNovelId = params.novelId;
        break;
      }
    }
    // 小説詳細ページ内にいる場合で、かつ未選択または異なる場合は自動追従
    if (currentNovelId && currentNovelId !== selectedNovelId) {
      setSelectedNovelId(currentNovelId);
    }
  }, [matches, setSelectedNovelId, selectedNovelId]);

  return null;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NovelRouteSync />
      <Nav />
      <main className="flex-1 overflow-hidden p-6 md:p-8">{children}</main>
      <ChatFloatingButton />
      <ChatDrawer />
    </div>
  );
}
