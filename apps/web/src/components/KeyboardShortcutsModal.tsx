import { Modal } from './Modal.js';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keyCombo: string;
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keyCombo: 'Ctrl + K / ⌘ + K',
    description: 'コマンドパレット（高速検索 & ジャンプ）を開く',
    category: '全般',
  },
  { keyCombo: 'Ctrl + J / ⌘ + J', description: 'AI創作相談チャットの開閉', category: '全般' },
  { keyCombo: '?', description: 'このショートカット一覧ヘルプを表示', category: '全般' },
  { keyCombo: 'Alt + 1', description: '概要 タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 2', description: '設定 タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 3', description: '人物 タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 4', description: 'プロット タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 5', description: '本文 タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 6', description: 'タイムライン タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Alt + 7', description: '伏線 タブに切り替え', category: 'ナビゲーション' },
  { keyCombo: 'Ctrl + S / ⌘ + S', description: '本文を即座に保存', category: 'エディタ' },
  {
    keyCombo: 'Esc',
    description: '全画面集中モードの解除 / モーダルを閉じる',
    category: 'エディタ',
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⌨️ キーボードショートカット一覧" size="md">
      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{cat}</h4>
            <div className="rounded-xl border border-border bg-surface-raised divide-y divide-border">
              {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                <div
                  key={s.keyCombo}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <span className="text-foreground">{s.description}</span>
                  <kbd className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-xs">
                    {s.keyCombo}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
