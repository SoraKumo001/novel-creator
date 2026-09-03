import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "@/routes/-pending.js";

export const Route = createFileRoute("/settings")({
  pendingComponent: RoutePending,
});
