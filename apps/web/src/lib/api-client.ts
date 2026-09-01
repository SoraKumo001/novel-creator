import type { ApiType } from "@novel-creator/api";
import { hc } from "hono/client";

const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

export const apiClient = hc<ApiType>(`${baseUrl}/api`);
