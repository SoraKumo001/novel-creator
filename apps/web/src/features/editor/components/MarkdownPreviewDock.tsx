import { useMemo } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import type { MarkdownPreviewMode } from "@/lib/editor-storage.js";
import { renderRubyLine } from "@/lib/sanitize.js";

/**
 * エディタ横の最小プレビュードック（開閉式）。
 * 横=GFMフルレンダ（MarkdownText 再利用）、縦=行分割+ルビ（VerticalPreviewModal 相当の既定値流用）。
 * サニタイズは共通 sanitize（renderRubyLine / MarkdownText 内蔵）を維持する。モーダルは削除しない。
 *
 * 表示モード型（MarkdownPreviewMode）は `@/lib/editor-storage` に集約し、
 * ここでは型のみ参照する（既存の import パス維持のため -MarkdownEditorCore が再エクスポートする）。
 */

// VerticalPreviewModal の既定値流用（新規設定画面は作らない）
const DOCK_VERTICAL_FONT_SIZE = 17;
const DOCK_VERTICAL_LINE_HEIGHT = 1.9;
const DOCK_VERTICAL_FONT_FAMILY =
  '"Hiragino Mincho ProN", "Yu Mincho", "Source Han Serif JP", "Noto Serif JP", serif';

function DockVerticalBody({
  title,
  body,
}: {
  title: string;
  body: string;
}): React.JSX.Element {
  const paragraphs = useMemo(() => {
    if (!body) {
      return [];
    }
    return body.split("\n").map((line) => renderRubyLine(line));
  }, [body]);
  return (
    <div
      data-testid="preview-vertical"
      className="flex h-full flex-col justify-start text-stone-900 dark:text-stone-100"
      style={{
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        fontFamily: DOCK_VERTICAL_FONT_FAMILY,
        fontSize: `${DOCK_VERTICAL_FONT_SIZE}px`,
        lineHeight: DOCK_VERTICAL_LINE_HEIGHT,
      }}
    >
      {title && (
        <h2
          className="mb-8 border-stone-400 border-l-2 py-2 pl-4 font-bold text-stone-800 tracking-widest dark:border-stone-600 dark:text-stone-200"
          style={{ fontSize: `${DOCK_VERTICAL_FONT_SIZE * 1.3}px` }}
        >
          {title}
        </h2>
      )}
      <div className="space-y-0 text-justify tracking-wide">
        {paragraphs.map((paraHtml, idx) => (
          <p
            key={idx}
            className="min-h-[1em]"
            style={{
              textIndent:
                paraHtml.startsWith("「") || paraHtml.startsWith("『")
                  ? 0
                  : "1em",
              marginBottom: paraHtml ? undefined : "1em",
            }}
            dangerouslySetInnerHTML={{ __html: paraHtml || "&nbsp;" }}
          />
        ))}
      </div>
    </div>
  );
}

export function MarkdownPreviewDock({
  mode,
  onModeChange,
  onClose,
  markdown,
  title,
}: {
  mode: MarkdownPreviewMode;
  onModeChange: (mode: MarkdownPreviewMode) => void;
  onClose: () => void;
  markdown: string;
  title: string;
}): React.JSX.Element {
  return (
    <aside
      className="flex w-[380px] shrink-0 flex-col overflow-hidden border-border border-l bg-surface"
      aria-label="プレビュー"
    >
      <div className="flex items-center justify-between border-border border-b px-3 py-1.5">
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="表示切替"
        >
          <button
            type="button"
            onClick={() => onModeChange("horizontal")}
            aria-pressed={mode === "horizontal"}
            title="横書きプレビュー（GFM）"
            className={`cursor-pointer rounded px-2 py-1 text-xs transition ${
              mode === "horizontal"
                ? "bg-primary font-bold text-primary-foreground"
                : "bg-surface-raised hover:text-foreground"
            }`}
          >
            横
          </button>
          <button
            type="button"
            onClick={() => onModeChange("vertical")}
            aria-pressed={mode === "vertical"}
            title="縦書きプレビュー（文庫本ビューアー相当）"
            className={`cursor-pointer rounded px-2 py-1 text-xs transition ${
              mode === "vertical"
                ? "bg-primary font-bold text-primary-foreground"
                : "bg-surface-raised hover:text-foreground"
            }`}
          >
            縦
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="プレビューを閉じる"
          title="プレビューを閉じる"
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-background p-4">
        {mode === "horizontal" ? (
          <MarkdownText content={markdown} />
        ) : (
          <DockVerticalBody title={title} body={markdown} />
        )}
      </div>
    </aside>
  );
}
