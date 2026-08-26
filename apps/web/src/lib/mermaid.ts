import mermaid from 'mermaid';

let initialized = false;
let currentTheme: 'default' | 'dark' = 'default';

function resolveTheme(): 'default' | 'dark' {
  if (typeof document === 'undefined') return 'default';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
}

function ensureInitialized(): void {
  const theme = resolveTheme();
  if (initialized && theme === currentTheme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
    suppressErrorRendering: true,
  });
  currentTheme = theme;
  initialized = true;
}

/**
 * 指定コンテナ内の `.mermaid` プレースホルダを SVG に差し替える。
 * 既にレンダリング済みのノードはスキップし、未初期化なら遅延初期化する。
 * エラー時はフォールバックとしてソースコードを表示する。
 */
export async function renderMermaid(container: HTMLElement): Promise<void> {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-rendered])'),
  );
  if (nodes.length === 0) return;

  ensureInitialized();

  await Promise.all(
    nodes.map(async (node) => {
      const src = node.textContent ?? '';
      node.setAttribute('data-mermaid-rendered', 'pending');
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const { svg } = await mermaid.render(id, src);
        node.innerHTML = svg;
        node.setAttribute('data-mermaid-rendered', 'done');
      } catch (err) {
        node.setAttribute('data-mermaid-rendered', 'error');
        const message = err instanceof Error ? err.message : String(err);
        node.innerHTML = `<pre class="mermaid-error">${escapeHtml(src)}\n\n// ${escapeHtml(message)}</pre>`;
      }
    }),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
