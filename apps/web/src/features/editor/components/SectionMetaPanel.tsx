import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import type { Section } from "@/lib/types.js";

interface SectionMetaPanelProps {
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft: { summary: string; title: string }) => void;
  onSave: (input: { summary: string; title: string }) => Promise<void>;
  saving: boolean;
  section: Section;
}

/** 本文タブ用の節メタ編集パネル（タイトル・概要）。折りたたみ式で視覚的に静かに保つ。 */
export function SectionMetaPanel({
  section,
  saving,
  onSave,
  onDirtyChange,
  onDraftChange,
}: SectionMetaPanelProps) {
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title ?? "");
  const [summaryDraft, setSummaryDraft] = useState(section.summary ?? "");

  useEffect(() => {
    setTitleDraft(section.title ?? "");
    setSummaryDraft(section.summary ?? "");
  }, [section.summary, section.title]);

  const baseTitle = section.title ?? "";
  const baseSummary = section.summary ?? "";
  const isDirty =
    titleDraft.trim() !== baseTitle.trim() || summaryDraft !== baseSummary;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onDraftChange?.({ summary: summaryDraft, title: titleDraft.trim() });
  }, [onDraftChange, summaryDraft, titleDraft]);

  const summaryPreview = baseSummary.trim()
    ? baseSummary.trim().slice(0, 48) +
      (baseSummary.trim().length > 48 ? "…" : "")
    : "未設定";

  const handleSave = async () => {
    if (!isDirty || saving) {
      return;
    }
    await onSave({ summary: summaryDraft, title: titleDraft.trim() });
  };

  const handleCancel = () => {
    setTitleDraft(baseTitle);
    setSummaryDraft(baseSummary);
  };

  return (
    <div className="shrink-0 border-border border-b bg-surface">
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-5 py-1.5 text-left text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
        title={open ? "概要パネルを閉じる" : "節の概要・タイトルを確認・編集"}
        type="button"
      >
        <span aria-hidden="true" className="text-[10px]">
          {open ? "▼" : "▶"}
        </span>
        <span className="font-medium">📝 節の概要</span>
        {!open && (
          <span className="min-w-0 flex-1 truncate font-normal">
            {summaryPreview}
          </span>
        )}
        {isDirty && (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            未保存の変更
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 px-5 pt-1 pb-3">
          <label className="block">
            <span className="mb-1 block font-medium text-[11px] text-muted-foreground">
              タイトル
            </span>
            <input
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground text-xs focus:border-primary focus:outline-none"
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder={`節 ${section.order}`}
              type="text"
              value={titleDraft}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-[11px] text-muted-foreground">
              概要
              <span className="ml-1 font-normal">
                （プロットタブと共有されます）
              </span>
            </span>
            <textarea
              className="w-full resize-y rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground text-xs leading-relaxed focus:border-primary focus:outline-none"
              onChange={(e) => setSummaryDraft(e.target.value)}
              placeholder="この節の概要・ポイントをメモ"
              rows={3}
              value={summaryDraft}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {summaryDraft.length} 文字
            </span>
            <div className="flex items-center gap-1.5">
              {isDirty && (
                <Button
                  disabled={saving}
                  onClick={handleCancel}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  取り消し
                </Button>
              )}
              <Button
                disabled={!isDirty}
                isLoading={saving}
                onClick={() => void handleSave()}
                size="sm"
                type="button"
                variant="primary"
              >
                概要を保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
