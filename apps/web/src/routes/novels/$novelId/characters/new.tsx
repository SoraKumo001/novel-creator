import { createFileRoute } from "@tanstack/react-router";
import { CharacterEditor } from "../../_components/-CharacterEditor.js";

export const Route = createFileRoute("/novels/$novelId/characters/new")({
  component: NewCharacterPage,
});

function NewCharacterPage() {
  const { novelId } = Route.useParams();
  return <CharacterEditor novelId={novelId} />;
}
