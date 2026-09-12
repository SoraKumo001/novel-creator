import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Modal } from "@/components/Modal.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name ?? "");
      setError(null);
    }
  }, [isOpen, user?.name]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("ユーザー名を入力してください。");
      return;
    }
    if (trimmed.length > 50) {
      setError("ユーザー名は50文字以内で入力してください。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateProfile(trimmed);
      toast.success("ユーザー名を更新しました");
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ユーザー名の変更" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-danger-border bg-danger-subtle p-2.5 text-danger-subtle-fg text-xs">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label
            htmlFor="edit-profile-name"
            className="block font-medium text-foreground text-xs"
          >
            表示名
          </label>
          <input
            id="edit-profile-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="例: 山田 太郎"
            maxLength={50}
            autoFocus
            disabled={saving}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground text-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>他のメンバーやサイドバーに表示される名前です</span>
            <span>{name.trim().length} / 50</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving || !name.trim()}
          >
            {saving ? "保存中..." : "変更を保存"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
