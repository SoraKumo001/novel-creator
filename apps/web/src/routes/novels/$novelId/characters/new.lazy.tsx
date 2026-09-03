import { createLazyFileRoute } from "@tanstack/react-router";
import { CharacterEditor } from "../../_components/-CharacterEditor.js";

export const Route = createLazyFileRoute("/novels/$novelId/characters/new")({
  component: NewCharacterPage,
});

export function NewCharacterPage() {
  const { novelId } = Route.useParams();
  return <CharacterEditor novelId={novelId} />;
}
