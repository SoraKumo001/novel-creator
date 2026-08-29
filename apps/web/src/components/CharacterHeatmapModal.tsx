import { useMemo, useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import type { ChapterWithSections, Character } from '@/lib/types.js';

interface CharacterHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  chapters: ChapterWithSections[];
  onSelectSection?: (sectionId: string) => void;
}

export function CharacterHeatmapModal({
  isOpen,
  onClose,
  characters,
  chapters,
  onSelectSection,
}: CharacterHeatmapModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 全節のフラットリスト
  const allSections = useMemo(() => {
    return chapters.flatMap((c) =>
      c.sections.map((s) => ({
        chapterId: c.id,
        chapterTitle: c.title,
        sectionId: s.id,
        sectionTitle: s.title || `節 ${s.order}`,
        summary: s.summary || '',
      })),
    );
  }, [chapters]);

  // カテゴリ一覧
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of characters) {
      if (c.category) set.add(c.category);
    }
    return Array.from(set);
  }, [characters]);

  // フィルタ済みキャラクター
  const filteredCharacters = useMemo(() => {
    if (selectedCategory === 'all') return characters;
    return characters.filter((c) => c.category === selectedCategory);
  }, [characters, selectedCategory]);

  // 各キャラの各節における出現度スコアリング（概要やタイトルからのマッチ）
  const matrixData = useMemo(() => {
    return filteredCharacters.map((char) => {
      const charName = char.name;
      const sectionScores = allSections.map((sec) => {
        // 概要やタイトルに含まれる回数
        const countInSummary = (sec.summary.match(new RegExp(charName, 'g')) || []).length;
        const countInTitle = (sec.sectionTitle.match(new RegExp(charName, 'g')) || []).length;
        const total = countInSummary * 2 + countInTitle * 3;
        return total;
      });

      const totalAppearances = sectionScores.filter((s) => s > 0).length;
      return {
        character: char,
        scores: sectionScores,
        totalAppearances,
      };
    });
  }, [allSections, filteredCharacters]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📊 登場人物・出現頻度ヒートマップ"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* カテゴリフィルタ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">所属・勢力:</span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded px-2.5 py-1 transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-surface-raised hover:bg-border text-foreground'
              }`}
            >
              すべて ({characters.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded px-2.5 py-1 transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-surface-raised hover:bg-border text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            全 {allSections.length} 節 / {characters.length} 人
          </div>
        </div>

        {/* ヒートマップテーブル */}
        <div className="rounded-xl border border-border bg-surface overflow-x-auto max-h-[60vh]">
          {filteredCharacters.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              キャラクターが登録されていません
            </div>
          ) : allSections.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              章や節がまだ作成されていません
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised sticky top-0 z-10">
                  <th className="p-3 font-semibold text-foreground min-w-36 sticky left-0 bg-surface-raised z-20 border-r border-border">
                    登場人物
                  </th>
                  {allSections.map((sec, idx) => (
                    <th
                      key={sec.sectionId}
                      onClick={() => {
                        if (onSelectSection) {
                          onClose();
                          onSelectSection(sec.sectionId);
                        }
                      }}
                      className={`p-2 font-medium text-center min-w-16 border-r border-border/50 truncate max-w-24 ${
                        onSelectSection ? 'cursor-pointer hover:bg-primary/20 transition' : ''
                      }`}
                      title={`${sec.chapterTitle} - ${sec.sectionTitle} (クリックで執筆画面へ移動)`}
                    >
                      <div className="text-[10px] text-muted-foreground truncate">S{idx + 1}</div>
                      <div className="text-[11px] truncate font-normal text-foreground">
                        {sec.sectionTitle}
                      </div>
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-foreground text-center min-w-20">
                    出番合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr
                    key={row.character.id}
                    className="border-b border-border/50 hover:bg-surface-raised/50 transition"
                  >
                    <td className="p-3 sticky left-0 bg-surface z-10 border-r border-border font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{row.character.name}</span>
                        {row.character.category && (
                          <span className="text-[10px] text-muted-foreground bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                            {row.character.category}
                          </span>
                        )}
                      </div>
                      {row.totalAppearances === 0 && (
                        <span className="text-[10px] text-rose-500 font-semibold block mt-0.5">
                          ⚠️ 出番なし
                        </span>
                      )}
                    </td>

                    {row.scores.map((score, sIdx) => {
                      const hasAppearance = score > 0;
                      const sec = allSections[sIdx];
                      return (
                        <td
                          key={sIdx}
                          onClick={() => {
                            if (onSelectSection) {
                              onClose();
                              onSelectSection(sec.sectionId);
                            }
                          }}
                          className={`p-2 text-center border-r border-border/50 transition ${
                            onSelectSection
                              ? 'cursor-pointer hover:ring-2 hover:ring-primary hover:z-20'
                              : ''
                          } ${
                            hasAppearance
                              ? score >= 4
                                ? 'bg-primary/40 font-bold text-primary-foreground'
                                : 'bg-primary/15 font-semibold text-primary'
                              : 'text-muted-foreground/30'
                          }`}
                          title={`${row.character.name} in ${sec.sectionTitle} (スコア: ${score} - クリックで本文へジャンプ)`}
                        >
                          {hasAppearance ? (score >= 4 ? '🔥' : '●') : '-'}
                        </td>
                      );
                    })}

                    <td className="p-3 text-center font-bold text-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          row.totalAppearances >= 3
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : row.totalAppearances > 0
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {row.totalAppearances} 節
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
