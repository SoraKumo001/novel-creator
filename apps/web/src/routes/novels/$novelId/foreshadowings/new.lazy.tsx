import { createLazyFileRoute } from "@tanstack/react-router";
import { ForeshadowingEditor } from "@/features/editor/components/ForeshadowingEditor.js";

export const Route = createLazyFileRoute("/novels/$novelId/foreshadowings/new")(
  {
    component: NewForeshadowingPage,
  }
);

export function NewForeshadowingPage() {
  const { novelId } = Route.useParams();
  return <ForeshadowingEditor novelId={novelId} />;
}
