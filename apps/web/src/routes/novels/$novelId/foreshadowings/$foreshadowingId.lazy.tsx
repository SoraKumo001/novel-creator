import { createLazyFileRoute } from "@tanstack/react-router";
import { ForeshadowingEditor } from "@/features/editor/components/ForeshadowingEditor.js";

export const Route = createLazyFileRoute(
  "/novels/$novelId/foreshadowings/$foreshadowingId"
)({
  component: EditForeshadowingPage,
});

export function EditForeshadowingPage() {
  const { novelId, foreshadowingId } = Route.useParams();
  return (
    <ForeshadowingEditor novelId={novelId} foreshadowingId={foreshadowingId} />
  );
}
