import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card, CardHeader } from "@/components/Card.js";
import { EmptyState } from "@/components/EmptyState.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { MarkdownText } from "@/components/MarkdownText.js";
import { Modal } from "@/components/Modal.js";
import { Textarea } from "@/components/Textarea.js";
import { useNovels } from "@/hooks/useNovels.js";
import { toErrorMessage } from "@/lib/errors.js";

export const Route = createFileRoute("/novels/")({
  component: NovelsIndexPage,
});

function NovelsIndexPage() {
  const { novels, loading, error, createNovel, creating, refetch } =
    useNovels();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function formatDate(value: string | null): string {
    if (!value) {
      return "未設定";
    }
    return new Date(value).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError("タイトルを入力してください");
      return;
    }
    try {
      await createNovel({
        title: title.trim(),
        description: description.trim(),
      });
      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      void refetch();
    } catch (e) {
      setFormError(toErrorMessage(e));
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-foreground tracking-tight">
            小説一覧
          </h1>
          <p className="mt-1 text-muted">
            あなたの物語をここから始めましょう。
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon />}>
          新規作成
        </Button>
      </div>

      {loading && <Loading message="読み込み中..." />}

      {!loading && error && (
        <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
          {error}
        </div>
      )}

      {!loading && !error && novels.length === 0 && (
        <EmptyState
          title="まだ小説がありません"
          description="新規作成ボタンから、最初の物語を作り始めましょう。"
          actionLabel="小説を作成する"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {!loading && !error && novels.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {novels.map((novel) => (
            <Link
              key={novel.id}
              to="/novels/$novelId"
              params={{ novelId: novel.id }}
            >
              <Card className="h-full">
                <CardHeader
                  title={novel.title}
                  subtitle={formatDate(novel.updatedAt)}
                />
                {novel.description ? (
                  <MarkdownText
                    content={novel.description}
                    className="line-clamp-3 text-foreground-secondary text-sm leading-relaxed [&_p]:my-0 [&_p]:leading-relaxed"
                  />
                ) : (
                  <p className="text-muted text-sm italic">
                    説明がありません。
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (creating) {
            return;
          }
          setIsModalOpen(false);
          setFormError(null);
        }}
        title="新しい小説を作成"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={creating}
            >
              キャンセル
            </Button>
            <Button onClick={handleSubmit} isLoading={creating}>
              作成
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 星を紡ぐ者たち"
            autoFocus
          />
          <Textarea
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="物語のあらすじやテーマを簡潔に"
            rows={4}
          />
          {formError && <p className="text-rose-500 text-sm">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}
