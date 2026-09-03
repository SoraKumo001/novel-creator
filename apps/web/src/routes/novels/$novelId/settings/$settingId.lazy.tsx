import { createLazyFileRoute } from "@tanstack/react-router";
import { SettingEditor } from "../../_components/-SettingEditor.js";

export const Route = createLazyFileRoute(
  "/novels/$novelId/settings/$settingId"
)({
  component: EditSettingPage,
});

export function EditSettingPage() {
  const { novelId, settingId } = Route.useParams();
  return <SettingEditor novelId={novelId} settingId={settingId} />;
}
