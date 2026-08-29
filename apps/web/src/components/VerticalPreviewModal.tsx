import { useMemo, useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import { parseRubyToHtml } from '@novel-creator/shared';

interface VerticalPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string;
}

type FontFamily = 'serif' | 'sans';

export function VerticalPreviewModal({ isOpen, onClose, title, body }: VerticalPreviewModalProps) {
  const [fontSize, setFontSize] = useState<number>(17);
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [lineHeight, setLineHeight] = useState<number>(1.9);

  // ルビや傍点をパースしたHTMLを段落ごとに生成
  const parsedParagraphs = useMemo(() => {
    if (!body) return [];
    return body.split('\n').map((line) => parseRubyToHtml(line));
  }, [body]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📖 縦書きプレビュー（文庫本ビューアー）"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>フォント:</span>
            <button
              type="button"
              onClick={() => setFontFamily('serif')}
              className={`rounded px-2 py-1 transition cursor-pointer ${
                fontFamily === 'serif'
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-surface-raised hover:text-foreground'
              }`}
            >
              明朝体
            </button>
            <button
              type="button"
              onClick={() => setFontFamily('sans')}
              className={`rounded px-2 py-1 transition cursor-pointer ${
                fontFamily === 'sans'
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-surface-raised hover:text-foreground'
              }`}
            >
              ゴシック体
            </button>
            <span>•</span>
            <span>文字サイズ:</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(13, s - 1))}
              className="rounded bg-surface-raised px-2 py-1 hover:bg-border transition cursor-pointer"
            >
              A-
            </button>
            <span className="font-mono">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(24, s + 1))}
              className="rounded bg-surface-raised px-2 py-1 hover:bg-border transition cursor-pointer"
            >
              A+
            </button>
            <span>•</span>
            <span>行間:</span>
            <button
              type="button"
              onClick={() =>
                setLineHeight((lh) => Math.max(1.5, parseFloat((lh - 0.1).toFixed(1))))
              }
              className="rounded bg-surface-raised px-2 py-1 hover:bg-border transition cursor-pointer"
            >
              詰
            </button>
            <button
              type="button"
              onClick={() =>
                setLineHeight((lh) => Math.min(2.5, parseFloat((lh + 0.1).toFixed(1))))
              }
              className="rounded bg-surface-raised px-2 py-1 hover:bg-border transition cursor-pointer"
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
      <div className="relative h-[65vh] w-full rounded-xl border border-border bg-[#faf7f2] dark:bg-[#18181b] p-6 shadow-inner overflow-x-auto overflow-y-hidden select-text">
        {/* 縦書きレンダリング領域 */}
        <div
          className="h-full flex flex-col justify-start text-stone-900 dark:text-stone-100"
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily:
              fontFamily === 'serif'
                ? '"Hiragino Mincho ProN", "Yu Mincho", "Source Han Serif JP", "Noto Serif JP", serif'
                : '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif',
            fontSize: `${fontSize}px`,
            lineHeight,
            paddingRight: '1rem',
            paddingLeft: '2rem',
          }}
        >
          {/* 章・節タイトル */}
          {title && (
            <h2
              className="mb-8 font-bold tracking-widest text-stone-800 dark:text-stone-200 border-l-2 border-stone-400 dark:border-stone-600 pl-4 py-2"
              style={{ fontSize: `${fontSize * 1.3}px` }}
            >
              {title}
            </h2>
          )}

          {/* 本文段落 */}
          <div className="space-y-0 tracking-wide text-justify">
            {parsedParagraphs.map((paraHtml, idx) => (
              <p
                key={idx}
                className="min-h-[1em]"
                style={{
                  textIndent: paraHtml.startsWith('「') || paraHtml.startsWith('『') ? 0 : '1em',
                  marginBottom: paraHtml ? undefined : '1em',
                }}
                dangerouslySetInnerHTML={{ __html: paraHtml || '&nbsp;' }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
