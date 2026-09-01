import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "削除",
  cancelLabel = "キャンセル",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-foreground-secondary text-sm">{message}</p>
    </Modal>
  );
}
