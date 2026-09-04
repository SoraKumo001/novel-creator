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
import { novelMemberKeys } from "@/lib/queryKeys.js";
import {
  addNovelMember,
  fetchNovelMembers,
  removeNovelMember,
  updateNovelMemberRole,
} from "@/lib/services/auth.js";
import type { NovelMemberDisplayRole } from "@/lib/types.js";
import { RoutePending } from "@/routes/-pending.js";

export const Route = createFileRoute("/novels/$novelId/members")({
  pendingComponent: RoutePending,
  component: NovelMembersPage,
});

const DISPLAY_ROLES: NovelMemberDisplayRole[] = ["owner", "admin"];

export function NovelMembersPage() {
  const { novelId } = Route.useParams();
  const { user, isAdmin, authLoading } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NovelMemberDisplayRole>("admin");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: novelMemberKeys.list(novelId),
    queryFn: () => fetchNovelMembers(novelId),
    enabled: !authLoading,
  });

  const myRole = members.find((m) => m.userId === user?.id)?.role ?? null;
  const canManage = isAdmin || myRole === "owner";

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: novelMemberKeys.list(novelId),
    });

  const addMutation = useMutation({
    mutationFn: () => addNovelMember(novelId, { email: email.trim(), role }),
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      toast.success("メンバーを追加しました");
      void invalidate();
    },
    onError: (e) => setFormError(toErrorMessage(e)),
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      next,
    }: {
      userId: string;
      next: NovelMemberDisplayRole;
    }) => updateNovelMemberRole(novelId, userId, next),
    onSuccess: () => {
      toast.success("権限を変更しました");
      void invalidate();
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeNovelMember(novelId, userId),
    onSuccess: () => {
      toast.success("メンバーを削除しました");
      void invalidate();
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  });

  if (authLoading) {
    return <Loading message="確認中..." />;
  }

  if (!canManage && !isLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          メンバー管理
        </h1>
        <p className="mt-2 text-muted text-sm">
          このページはオーナーまたは管理者のみ利用できます。
        </p>
      </div>
    );
  }

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError("メールアドレスを入力してください");
      return;
    }
    await addMutation.mutateAsync();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        メンバー管理
      </h1>
      <p className="mt-1 text-muted text-sm">
        小説の共有メンバーを追加・変更できます（owner / admin）。
      </p>

      <Card className="mt-6">
        <CardHeader title="メンバーを追加" />
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            autoComplete="off"
          />
          <div>
            <label
              htmlFor="member-role"
              className="mb-1.5 block font-medium text-foreground-secondary text-sm"
            >
              権限
            </label>
            <Select
              id="member-role"
              className="w-full px-3 py-2 text-sm"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as NovelMemberDisplayRole)
              }
            >
              {DISPLAY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <div>
            <Button type="submit" isLoading={addMutation.isPending}>
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
        {!isLoading && !error && members.length === 0 && (
          <EmptyState
            title="メンバーがいません"
            description="上のフォームから追加してください。"
          />
        )}
        {!isLoading && !error && members.length > 0 && (
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <Card key={m.userId}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground text-sm">
                      {m.email ?? m.userId}
                    </p>
                    <p className="truncate text-muted text-xs">{m.userId}</p>
                  </div>
                  <Select
                    aria-label={`${m.email ?? m.userId} の権限`}
                    className="px-2 py-1.5 text-sm"
                    value={m.role === "owner" ? "owner" : "admin"}
                    disabled={roleMutation.isPending}
                    onChange={(e) =>
                      roleMutation.mutate({
                        userId: m.userId,
                        next: e.target.value as NovelMemberDisplayRole,
                      })
                    }
                  >
                    {DISPLAY_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.userId)}
                  >
                    削除
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
