import { useEffect, useMemo, useRef } from "react";
import { renderMermaid } from "@/lib/mermaid.js";
import { renderMarkdownWithRuby } from "@/lib/sanitize.js";

interface MarkdownTextProps {
  className?: string;
  /** 折り返し表示用のコンパクトスタイル。LLM 出力の小さなボックス内表示向け。 */
  compact?: boolean;
  content: string;
  /** ストリーミング中など未確定テキスト時に Mermaid レンダリングを抑止するフラグ */
  disableMermaid?: boolean;
}

export function MarkdownText({
  content,
  className,
  compact,
  disableMermaid,
}: MarkdownTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdownWithRuby(content), [content]);

  useEffect(() => {
    if (disableMermaid) {
      return;
    }
    // mermaid フェンスが無い HTML では DOM 走査を省略する（結果は不変）
    if (!html.includes("language-mermaid")) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    const mermaidBlocks = el.querySelectorAll("pre > code.language-mermaid");
    if (mermaidBlocks.length === 0) {
      return;
    }

    // marked が出力した ```mermaid コードブロックをプレースホルダに差し替え
    mermaidBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre) {
        return;
      }
      const src = codeEl.textContent ?? "";
      const div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = src;
      pre.replaceWith(div);
    });

    const handle = window.requestAnimationFrame(() => {
      void renderMermaid(el);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [html, disableMermaid]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ""} ${compact ? "prose-headings:hidden prose-strong:text-inherit text-[11px] leading-relaxed" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
