import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "@/routes/-pending.js";

const TAB_IDS = [
  "overview",
  "outline",
  "characters",
  "settings",
  "foreshadowing",
  "timeline",
  "plot",
  "editor",
] as const;

export const Route = createFileRoute("/novels/$novelId/")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: (TAB_IDS.includes(search.tab as (typeof TAB_IDS)[number])
        ? search.tab
        : undefined) as (typeof TAB_IDS)[number] | undefined,
    }) as { tab?: (typeof TAB_IDS)[number] },
  pendingComponent: RoutePending,
});
