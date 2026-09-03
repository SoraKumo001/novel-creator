import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface ShortcutItem {
  description: string;
  keys: string[];
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["Alt", "1〜8"],
    description:
      "タブ切り替え（概要・構想・人物・設定・伏線・タイムライン・プロット・本文）",
  },
  { keys: ["Ctrl", "J"], description: "AI創作相談の開閉（Mac は ⌘＋J）" },
  { keys: ["Ctrl", "Enter"], description: "チャット入力の送信" },
  { keys: ["Esc"], description: "ダイアログ・全画面表示を閉じる" },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⌨ キーボードショートカット"
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <ul className="space-y-3">
        {SHORTCUTS.map((item) => (
          <li
            key={item.description}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="min-w-0 flex-1 text-foreground-secondary">
              {item.description}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {item.keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
