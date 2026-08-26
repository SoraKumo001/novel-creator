import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { renderMermaid } from '@/lib/mermaid.js';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw) as string;
  }, [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // marked が出力した ```mermaid コードブロックをプレースホルダに差し替え
    el.querySelectorAll('pre > code.language-mermaid').forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre) return;
      const src = codeEl.textContent ?? '';
      const div = document.createElement('div');
      div.className = 'mermaid';
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
      className={`prose prose-sm max-w-none dark:prose-invert ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
