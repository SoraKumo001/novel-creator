import { createLazyFileRoute } from "@tanstack/react-router";
import { SettingEditor } from "../../_components/-SettingEditor.js";

export const Route = createLazyFileRoute("/novels/$novelId/settings/new")({
  component: NewSettingPage,
});

export function NewSettingPage() {
  const { novelId } = Route.useParams();
  return <SettingEditor novelId={novelId} />;
}
