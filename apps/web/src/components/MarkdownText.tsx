import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useRef } from "react";
import { renderMermaid } from "@/lib/mermaid.js";

interface MarkdownTextProps {
  className?: string;
  /** 折り返し表示用のコンパクトスタイル。LLM 出力の小さなボックス内表示向け。 */
  compact?: boolean;
  content: string;
}

export function MarkdownText({
  content,
  className,
  compact,
}: MarkdownTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false, breaks: true }) as string;
    return DOMPurify.sanitize(raw) as string;
  }, [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    // marked が出力した ```mermaid コードブロックをプレースホルダに差し替え
    el.querySelectorAll("pre > code.language-mermaid").forEach((codeEl) => {
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
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ""} ${compact ? "prose-headings:hidden prose-strong:text-inherit text-[11px] leading-relaxed" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
