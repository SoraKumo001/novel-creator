import { createFileRoute } from '@tanstack/react-router';
import { CharacterEditor } from '../../_components/-CharacterEditor.js';

export const Route = createFileRoute('/novels/$novelId/characters/$characterId')({
  component: EditCharacterPage,
});

function EditCharacterPage() {
  const { novelId, characterId } = Route.useParams();
  return <CharacterEditor novelId={novelId} characterId={characterId} />;
}
