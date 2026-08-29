import { Button } from '@/components/Button.js';
import { Modal } from '@/components/Modal.js';
import type { ExtractResult } from '@/lib/types.js';

export function ExtractResultModal({
  isOpen,
  onClose,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: ExtractResult | null;
}) {
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="整合性更新結果"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された時系列</h4>
          {result.timelines.length === 0 ? (
            <p className="text-sm text-muted-foreground">ありません</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {result.timelines.map((timeline, idx) => (
                <li
                  key={timeline.id ?? idx}
                  className="rounded bg-surface-raised px-3 py-2 border border-border"
                >
                  {timeline.timestamp && (
                    <span className="mr-2 text-xs text-muted-foreground">{timeline.timestamp}</span>
                  )}
                  {timeline.event}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された設定</h4>
          {result.settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">ありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.settings.map((setting, idx) => (
                <li
                  key={setting.id ?? idx}
                  className="rounded bg-surface-raised px-3 py-2 border border-border"
                >
                  <span className="text-xs font-bold uppercase text-primary">
                    {setting.category}
                  </span>
                  <div className="font-medium text-foreground">{setting.name}</div>
                  <div className="text-sm text-muted-foreground">{setting.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
