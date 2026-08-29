import { useEffect, useMemo, useRef, useState } from 'react';
import type { Character, ChapterWithSections, Setting, Foreshadowing } from '@/lib/types.js';

export interface CommandItem {
  id: string;
  category: '節・本文' | '章' | '登場人物' | '世界観設定' | '伏線' | 'アクション';
  icon: string;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  novelId: string;
  chapters?: ChapterWithSections[];
  characters?: Character[];
  settings?: Setting[];
  foreshadowings?: Foreshadowing[];
  onNavigateTab: (tabId: string) => void;
  onSelectSection?: (sectionId: string) => void;
  onOpenVerticalPreview?: () => void;
  onOpenCharacterGraph?: () => void;
  onOpenHeatmap?: () => void;
  onOpenExport?: () => void;
  onToggleChat?: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  chapters = [],
  characters = [],
  settings = [],
  foreshadowings = [],
  onNavigateTab,
  onSelectSection,
  onOpenVerticalPreview,
  onOpenCharacterGraph,
  onOpenHeatmap,
  onOpenExport,
  onToggleChat,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // コマンドリストの構築
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // アクション
    if (onOpenVerticalPreview) {
      list.push({
        id: 'action-vertical',
        category: 'アクション',
        icon: '📖',
        title: '文庫風 縦書きプレビュー',
        subtitle: '原稿を縦書き・ルビ付きで表示',
        onSelect: () => {
          onClose();
          onOpenVerticalPreview();
        },
      });
    }

    if (onOpenCharacterGraph) {
      list.push({
        id: 'action-graph',
        category: 'アクション',
        icon: '🕸️',
        title: '人物相関図（Mermaid）を表示',
        subtitle: '登場人物の関係図マップを確認',
        onSelect: () => {
          onClose();
          onOpenCharacterGraph();
        },
      });
    }

    if (onOpenHeatmap) {
      list.push({
        id: 'action-heatmap',
        category: 'アクション',
        icon: '📊',
        title: '登場人物 出現頻度ヒートマップ',
        subtitle: '全章節のキャラ出番偏りを分析',
        onSelect: () => {
          onClose();
          onOpenHeatmap();
        },
      });
    }

    if (onToggleChat) {
      list.push({
        id: 'action-chat',
        category: 'アクション',
        icon: '💬',
        title: 'AI創作相談チャットの開閉',
        subtitle: 'Ctrl + J でも開閉可能',
        onSelect: () => {
          onClose();
          onToggleChat();
        },
      });
    }

    if (onOpenExport) {
      list.push({
        id: 'action-export',
        category: 'アクション',
        icon: '📤',
        title: '全文テキスト / Markdown エクスポート',
        subtitle: '小説全体をファイル出力',
        onSelect: () => {
          onClose();
          onOpenExport();
        },
      });
    }

    // 章・節
    for (const chap of chapters) {
      list.push({
        id: `chap-${chap.id}`,
        category: '章',
        icon: '📑',
        title: `${chap.title || `第${chap.order}章`}`,
        subtitle: chap.summary ? chap.summary.slice(0, 40) : undefined,
        onSelect: () => {
          onClose();
          onNavigateTab('plot');
        },
      });

      for (const sect of chap.sections) {
        list.push({
          id: `sect-${sect.id}`,
          category: '節・本文',
          icon: '✍️',
          title: `${sect.title || `第${sect.order}節`}`,
          subtitle: `${chap.title || `第${chap.order}章`} - ${sect.summary?.slice(0, 30) || '概要なし'}`,
          onSelect: () => {
            onClose();
            onNavigateTab('editor');
            if (onSelectSection) onSelectSection(sect.id);
          },
        });
      }
    }

    // 登場人物
    for (const char of characters) {
      list.push({
        id: `char-${char.id}`,
        category: '登場人物',
        icon: '👤',
        title: char.name,
        subtitle: `${char.category || '未分類'} | ${char.description?.slice(0, 40) || '説明なし'}`,
        onSelect: () => {
          onClose();
          onNavigateTab('characters');
        },
      });
    }

    // 世界観設定
    for (const sett of settings) {
      list.push({
        id: `sett-${sett.id}`,
        category: '世界観設定',
        icon: '🌍',
        title: sett.name,
        subtitle: `${sett.category} | ${sett.description?.slice(0, 40) || '説明なし'}`,
        onSelect: () => {
          onClose();
          onNavigateTab('settings');
        },
      });
    }

    // 伏線
    for (const f of foreshadowings) {
      list.push({
        id: `fore-${f.id}`,
        category: '伏線',
        icon: '🚩',
        title: f.title,
        subtitle: `状態: ${f.status} | ${f.description?.slice(0, 30) || ''}`,
        onSelect: () => {
          onClose();
          onNavigateTab('foreshadowing');
        },
      });
    }

    return list;
  }, [
    chapters,
    characters,
    settings,
    foreshadowings,
    onClose,
    onNavigateTab,
    onSelectSection,
    onOpenVerticalPreview,
    onOpenCharacterGraph,
    onOpenHeatmap,
    onToggleChat,
    onOpenExport,
  ]);

  // 検索フィルタリング
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [allCommands, query]);

  // 開いた時にフォーカス
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // キーボードナビゲーション (上下矢印, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-black/50 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 検索入力バー */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-surface">
          <span className="text-lg text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="ジャンプ先を検索 (節名、人物名、設定、アクション...)"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-block rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* 候補リスト */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-border/30">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              該当する項目が見つかりません
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-surface-raised text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{cmd.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cmd.title}</div>
                      {cmd.subtitle && (
                        <div
                          className={`text-xs truncate ${
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          }`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                      isSelected
                        ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground'
                        : 'border-border bg-surface-raised text-muted-foreground'
                    }`}
                  >
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* フッターショートカットヒント */}
        <div className="border-t border-border px-4 py-2 bg-surface-raised flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ 移動</span>
            <span>↵ 決定</span>
            <span>ESC 閉じる</span>
          </div>
          <span>全 {filteredCommands.length} 項目</span>
        </div>
      </div>
    </div>
  );
}
