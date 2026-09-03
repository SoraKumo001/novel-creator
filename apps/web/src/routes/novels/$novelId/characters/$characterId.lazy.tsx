import { createLazyFileRoute } from "@tanstack/react-router";
import { CharacterEditor } from "../../_components/-CharacterEditor.js";

export const Route = createLazyFileRoute(
  "/novels/$novelId/characters/$characterId"
)({
  component: EditCharacterPage,
});

export function EditCharacterPage() {
  const { novelId, characterId } = Route.useParams();
  return <CharacterEditor novelId={novelId} characterId={characterId} />;
}
