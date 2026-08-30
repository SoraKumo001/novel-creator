import { createFileRoute } from '@tanstack/react-router';
import { ForeshadowingEditor } from '../../_components/-ForeshadowingEditor.js';

export const Route = createFileRoute('/novels/$novelId/foreshadowings/new')({
  component: NewForeshadowingPage,
});

function NewForeshadowingPage() {
  const { novelId } = Route.useParams();
  return <ForeshadowingEditor novelId={novelId} />;
}
