import { createFileRoute } from '@tanstack/react-router';
import { ForeshadowingEditor } from '../../_components/-ForeshadowingEditor.js';

export const Route = createFileRoute('/novels/$novelId/foreshadowings/$foreshadowingId')({
  component: EditForeshadowingPage,
});

function EditForeshadowingPage() {
  const { novelId, foreshadowingId } = Route.useParams();
  return <ForeshadowingEditor novelId={novelId} foreshadowingId={foreshadowingId} />;
}
