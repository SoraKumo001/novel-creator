import { createFileRoute } from "@tanstack/react-router";
import { SettingEditor } from "../../_components/-SettingEditor.js";

export const Route = createFileRoute("/novels/$novelId/settings/$settingId")({
  component: EditSettingPage,
});

function EditSettingPage() {
  const { novelId, settingId } = Route.useParams();
  return <SettingEditor novelId={novelId} settingId={settingId} />;
}
