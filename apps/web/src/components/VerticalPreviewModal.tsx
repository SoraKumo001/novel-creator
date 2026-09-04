import { useMemo, useState } from "react";
import { renderRubyLine } from "@/lib/sanitize.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface VerticalPreviewModalProps {
  body: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

type FontFamily = "serif" | "sans";

export function VerticalPreviewModal({
  isOpen,
  onClose,
  title,
  body,
}: VerticalPreviewModalProps) {
  const [fontSize, setFontSize] = useState<number>(17);
  const [fontFamily, setFontFamily] = useState<FontFamily>("serif");
  const [lineHeight, setLineHeight] = useState<number>(1.9);

  // ルビや傍点をパースしたHTMLを段落ごとに生成
  const parsedParagraphs = useMemo(() => {
    if (!body) {
      return [];
    }
    return body.split("\n").map((line) => renderRubyLine(line));
  }, [body]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📖 縦書きプレビュー（文庫本ビューアー）"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span>フォント:</span>
            <button
              type="button"
              onClick={() => setFontFamily("serif")}
              className={`cursor-pointer rounded px-2 py-1 transition ${
                fontFamily === "serif"
                  ? "bg-primary font-bold text-primary-foreground"
                  : "bg-surface-raised hover:text-foreground"
              }`}
            >
              明朝体
            </button>
            <button
              type="button"
              onClick={() => setFontFamily("sans")}
              className={`cursor-pointer rounded px-2 py-1 transition ${
                fontFamily === "sans"
                  ? "bg-primary font-bold text-primary-foreground"
                  : "bg-surface-raised hover:text-foreground"
              }`}
            >
              ゴシック体
            </button>
            <span>•</span>
            <span>文字サイズ:</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(13, s - 1))}
              className="cursor-pointer rounded bg-surface-raised px-2 py-1 transition hover:bg-border"
            >
              A-
            </button>
            <span className="font-mono">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(24, s + 1))}
              className="cursor-pointer rounded bg-surface-raised px-2 py-1 transition hover:bg-border"
            >
              A+
            </button>
            <span>•</span>
            <span>行間:</span>
            <button
              type="button"
              onClick={() =>
                setLineHeight((lh) =>
                  Math.max(1.5, Number.parseFloat((lh - 0.1).toFixed(1)))
                )
              }
              className="cursor-pointer rounded bg-surface-raised px-2 py-1 transition hover:bg-border"
            >
              詰
            </button>
            <button
              type="button"
              onClick={() =>
                setLineHeight((lh) =>
                  Math.min(2.5, Number.parseFloat((lh + 0.1).toFixed(1)))
                )
              }
              className="cursor-pointer rounded bg-surface-raised px-2 py-1 transition hover:bg-border"
            >
              広
            </button>
          </div>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      }
    >
      <div className="relative h-[65vh] w-full select-text overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-[#faf7f2] p-6 shadow-inner dark:bg-[#18181b]">
        {/* 縦書きレンダリング領域 */}
        <div
          className="flex h-full flex-col justify-start text-stone-900 dark:text-stone-100"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontFamily:
              fontFamily === "serif"
                ? '"Hiragino Mincho ProN", "Yu Mincho", "Source Han Serif JP", "Noto Serif JP", serif'
                : '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif',
            fontSize: `${fontSize}px`,
            lineHeight,
            paddingRight: "1rem",
            paddingLeft: "2rem",
          }}
        >
          {/* 章・節タイトル */}
          {title && (
            <h2
              className="mb-8 border-stone-400 border-l-2 py-2 pl-4 font-bold text-stone-800 tracking-widest dark:border-stone-600 dark:text-stone-200"
              style={{ fontSize: `${fontSize * 1.3}px` }}
            >
              {title}
            </h2>
          )}

          {/* 本文段落 */}
          <div className="space-y-0 text-justify tracking-wide">
            {parsedParagraphs.map((paraHtml, idx) => (
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
      </div>
    </Modal>
  );
}
