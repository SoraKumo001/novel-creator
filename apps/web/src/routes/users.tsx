import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card, CardHeader } from "@/components/Card.js";
import { EmptyState } from "@/components/EmptyState.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { Select } from "@/components/Select.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { userKeys } from "@/lib/queryKeys.js";
import {
  createUserByAdmin,
  fetchUsers,
  updateUserByAdmin,
} from "@/lib/services/auth.js";
import type { UserRole } from "@/lib/types.js";
import { RoutePending } from "@/routes/-pending.js";

export const Route = createFileRoute("/users")({
  pendingComponent: RoutePending,
  component: UsersPage,
});

export function UsersPage() {
  const { isAdmin, authLoading } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: userKeys.all,
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: userKeys.all });

  const createMutation = useMutation({
    mutationFn: () =>
      createUserByAdmin({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role: "user",
      }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setName("");
      setFormError(null);
      toast.success("ユーザーを作成しました");
      void invalidate();
    },
    onError: (e) => setFormError(toErrorMessage(e)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      updateUserByAdmin(id, { role }),
    onSuccess: () => {
      toast.success("権限を変更しました");
      void invalidate();
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  });

  const disabledMutation = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      updateUserByAdmin(id, { disabled }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.disabled ? "ユーザーを無効化しました" : "ユーザーを有効化しました"
      );
      void invalidate();
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  });

  if (authLoading) {
    return <Loading message="確認中..." />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          ユーザー管理
        </h1>
        <p className="mt-2 text-muted text-sm">
          このページは管理者のみ利用できます。
        </p>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || !password) {
      setFormError("メールアドレスとパスワードを入力してください");
      return;
    }
    await createMutation.mutateAsync();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        ユーザー管理
      </h1>
      <p className="mt-1 text-muted text-sm">
        ユーザーの追加・権限変更・無効化ができます。
      </p>

      <Card className="mt-6">
        <CardHeader
          title="ユーザーを追加"
          subtitle="初期権限は一般ユーザーです"
        />
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Input
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田太郎"
            autoComplete="off"
          />
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            autoComplete="off"
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <div>
            <Button type="submit" isLoading={createMutation.isPending}>
              追加する
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        {isLoading && <Loading message="読み込み中..." />}
        {!isLoading && error && (
          <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
            {toErrorMessage(error)}
          </div>
        )}
        {!isLoading && !error && users.length === 0 && (
          <EmptyState
            title="ユーザーがいません"
            description="上のフォームから追加してください。"
          />
        )}
        {!isLoading && !error && users.length > 0 && (
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <Card key={u.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground text-sm">
                      {u.name || u.email}
                    </p>
                    <p className="truncate text-muted text-xs">{u.email}</p>
                    {u.disabled === true && (
                      <p className="mt-0.5 text-danger text-xs">無効化中</p>
                    )}
                  </div>
                  <Select
                    aria-label={`${u.email} の権限`}
                    className="px-2 py-1.5 text-sm"
                    value={u.role}
                    disabled={roleMutation.isPending}
                    onChange={(e) =>
                      roleMutation.mutate({
                        id: u.id,
                        role: e.target.value as UserRole,
                      })
                    }
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </Select>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabledMutation.isPending}
                    onClick={() =>
                      disabledMutation.mutate({
                        id: u.id,
                        disabled: u.disabled !== true,
                      })
                    }
                  >
                    {u.disabled === true ? "有効化" : "無効化"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
