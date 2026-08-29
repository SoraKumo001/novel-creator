import { useState } from 'react';
import type {
  Character,
  ChapterWithSections,
  Setting,
  Foreshadowing,
  Section,
} from '@/lib/types.js';

interface ReferenceSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  section: Section;
  chapter?: ChapterWithSections;
  characters: Character[];
  settings: Setting[];
  foreshadowings: Foreshadowing[];
}

type TabType = 'plot' | 'characters' | 'settings' | 'foreshadowings';

export function ReferenceSidePanel({
  isOpen,
  onClose,
  section,
  chapter,
  characters,
  settings,
  foreshadowings,
}: ReferenceSidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('plot');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 border-l border-border bg-surface flex flex-col h-full shrink-0 z-10 transition-all duration-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 bg-surface-raised">
        <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
          <span>📑</span>
          <span>参考資料・プロット常時参照</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-surface transition cursor-pointer text-xs"
          title="パネルを閉じる"
        >
          ✕
        </button>
      </div>

      {/* タブ */}
      <div className="flex border-b border-border bg-surface text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('plot')}
          className={`flex-1 py-2 px-2 text-center border-b-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'plot'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          🗺️ プロット
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('characters')}
          className={`flex-1 py-2 px-2 text-center border-b-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'characters'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 人物 ({characters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 px-2 text-center border-b-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'settings'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          🌍 設定 ({settings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('foreshadowings')}
          className={`flex-1 py-2 px-2 text-center border-b-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'foreshadowings'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          🚩 伏線 ({foreshadowings.length})
        </button>
      </div>

      {/* 検索バー (人物・設定・伏線時) */}
      {activeTab !== 'plot' && (
        <div className="p-2 border-b border-border bg-surface">
          <input
            type="text"
            placeholder="キーワード絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* プロット / 概要 */}
        {activeTab === 'plot' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-border bg-surface-raised p-3 space-y-1.5">
              <div className="font-bold text-foreground flex items-center gap-1">
                <span>📖</span>
                <span>{chapter?.title || '章'} の概要</span>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {chapter?.summary || '章概要が設定されていません'}
              </p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
              <div className="font-bold text-primary flex items-center gap-1">
                <span>✍️</span>
                <span>現在の節: {section.title || `第${section.order}節`}</span>
              </div>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {section.summary || '節概要が設定されていません'}
              </p>
            </div>

            {chapter?.sections && chapter.sections.length > 1 && (
              <div className="space-y-1.5 pt-2">
                <div className="font-semibold text-muted-foreground text-[11px]">
                  この章の他の節の流れ
                </div>
                <div className="space-y-1.5">
                  {chapter.sections.map((s) => {
                    const isCurrent = s.id === section.id;
                    return (
                      <div
                        key={s.id}
                        className={`p-2 rounded-lg border text-xs ${
                          isCurrent
                            ? 'border-primary bg-primary/10 font-medium text-foreground'
                            : 'border-border bg-surface text-muted-foreground'
                        }`}
                      >
                        <div className="font-semibold">{s.title || `第${s.order}節`}</div>
                        {s.summary && (
                          <div className="text-[11px] mt-0.5 line-clamp-2">{s.summary}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 登場人物 */}
        {activeTab === 'characters' && (
          <div className="space-y-2">
            {characters
              .filter(
                (c) =>
                  !searchQuery ||
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.traits?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
              )
              .map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-surface-raised p-2.5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{c.name}</span>
                    <span className="text-[10px] rounded bg-surface border border-border px-1.5 py-0.2 text-muted-foreground">
                      {c.category || '未分類'}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                      {c.description}
                    </p>
                  )}
                  {c.traits && c.traits.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.traits.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* 世界観設定 */}
        {activeTab === 'settings' && (
          <div className="space-y-2">
            {settings
              .filter(
                (s) =>
                  !searchQuery ||
                  s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.description?.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-surface-raised p-2.5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{s.name}</span>
                    <span className="text-[10px] rounded bg-surface border border-border px-1.5 py-0.2 text-muted-foreground">
                      {s.category}
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                      {s.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* 伏線 */}
        {activeTab === 'foreshadowings' && (
          <div className="space-y-2">
            {foreshadowings
              .filter(
                (f) =>
                  !searchQuery ||
                  f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  f.description?.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-border bg-surface-raised p-2.5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{f.title}</span>
                    <span
                      className={`text-[10px] rounded px-1.5 py-0.2 font-semibold ${
                        f.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : f.status === 'abandoned'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {f.status === 'resolved'
                        ? '回収済'
                        : f.status === 'abandoned'
                          ? '破棄'
                          : '未回収'}
                    </span>
                  </div>
                  {f.description && (
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                      {f.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </aside>
  );
}
