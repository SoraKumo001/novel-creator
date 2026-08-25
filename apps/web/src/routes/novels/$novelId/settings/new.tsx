import { createFileRoute } from '@tanstack/react-router';
import { SettingEditor } from '../../_components/-SettingEditor.js';

export const Route = createFileRoute('/novels/$novelId/settings/new')({
  component: NewSettingPage,
});

function NewSettingPage() {
  const { novelId } = Route.useParams();
  return <SettingEditor novelId={novelId} />;
}
