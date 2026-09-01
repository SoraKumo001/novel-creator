import { useMemo, useState } from "react";
import type { ChapterWithSections, Character } from "@/lib/types.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface CharacterHeatmapModalProps {
  chapters: ChapterWithSections[];
  characters: Character[];
  isOpen: boolean;
  onClose: () => void;
  onSelectSection?: (sectionId: string) => void;
}

export function CharacterHeatmapModal({
  isOpen,
  onClose,
  characters,
  chapters,
  onSelectSection,
}: CharacterHeatmapModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // 全節のフラットリスト
  const allSections = useMemo(
    () =>
      chapters.flatMap((c) =>
        c.sections.map((s) => ({
          chapterId: c.id,
          chapterTitle: c.title,
          sectionId: s.id,
          sectionTitle: s.title || `節 ${s.order}`,
          summary: s.summary || "",
        }))
      ),
    [chapters]
  );

  // カテゴリ一覧
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of characters) {
      if (c.category) {
        set.add(c.category);
      }
    }
    return Array.from(set);
  }, [characters]);

  // フィルタ済みキャラクター
  const filteredCharacters = useMemo(() => {
    if (selectedCategory === "all") {
      return characters;
    }
    return characters.filter((c) => c.category === selectedCategory);
  }, [characters, selectedCategory]);

  // 各キャラの各節における出現度スコアリング（概要やタイトルからのマッチ）
  const matrixData = useMemo(() => {
    return filteredCharacters.map((char) => {
      const charName = char.name;
      const sectionScores = allSections.map((sec) => {
        // 概要やタイトルに含まれる回数
        const countInSummary = (
          sec.summary.match(new RegExp(charName, "g")) || []
        ).length;
        const countInTitle = (
          sec.sectionTitle.match(new RegExp(charName, "g")) || []
        ).length;
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
              onClick={() => setSelectedCategory("all")}
              className={`cursor-pointer rounded px-2.5 py-1 transition ${
                selectedCategory === "all"
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "bg-surface-raised text-foreground hover:bg-border"
              }`}
            >
              すべて ({characters.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`cursor-pointer rounded px-2.5 py-1 transition ${
                  selectedCategory === cat
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "bg-surface-raised text-foreground hover:bg-border"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-muted-foreground text-xs">
            全 {allSections.length} 節 / {characters.length} 人
          </div>
        </div>

        {/* ヒートマップテーブル */}
        <div className="max-h-[60vh] overflow-x-auto rounded-xl border border-border bg-surface">
          {filteredCharacters.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              キャラクターが登録されていません
            </div>
          ) : allSections.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              章や節がまだ作成されていません
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="sticky top-0 z-10 border-border border-b bg-surface-raised">
                  <th className="sticky left-0 z-20 min-w-36 border-border border-r bg-surface-raised p-3 font-semibold text-foreground">
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
                      className={`min-w-16 max-w-24 truncate border-border/50 border-r p-2 text-center font-medium ${
                        onSelectSection
                          ? "cursor-pointer transition hover:bg-primary/20"
                          : ""
                      }`}
                      title={`${sec.chapterTitle} - ${sec.sectionTitle} (クリックで執筆画面へ移動)`}
                    >
                      <div className="truncate text-[10px] text-muted-foreground">
                        S{idx + 1}
                      </div>
                      <div className="truncate font-normal text-[11px] text-foreground">
                        {sec.sectionTitle}
                      </div>
                    </th>
                  ))}
                  <th className="min-w-20 p-3 text-center font-semibold text-foreground">
                    出番合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr
                    key={row.character.id}
                    className="border-border/50 border-b transition hover:bg-surface-raised/50"
                  >
                    <td className="sticky left-0 z-10 border-border border-r bg-surface p-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{row.character.name}</span>
                        {row.character.category && (
                          <span className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {row.character.category}
                          </span>
                        )}
                      </div>
                      {row.totalAppearances === 0 && (
                        <span className="mt-0.5 block font-semibold text-[10px] text-rose-500">
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
                          className={`border-border/50 border-r p-2 text-center transition ${
                            onSelectSection
                              ? "cursor-pointer hover:z-20 hover:ring-2 hover:ring-primary"
                              : ""
                          } ${
                            hasAppearance
                              ? score >= 4
                                ? "bg-primary/40 font-bold text-primary-foreground"
                                : "bg-primary/15 font-semibold text-primary"
                              : "text-muted-foreground/30"
                          }`}
                          title={`${row.character.name} in ${sec.sectionTitle} (スコア: ${score} - クリックで本文へジャンプ)`}
                        >
                          {hasAppearance ? (score >= 4 ? "🔥" : "●") : "-"}
                        </td>
                      );
                    })}

                    <td className="p-3 text-center font-bold text-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          row.totalAppearances >= 3
                            ? "bg-emerald-500/10 text-emerald-600"
                            : row.totalAppearances > 0
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
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
