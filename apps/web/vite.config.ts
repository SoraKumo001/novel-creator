import path from "node:path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxy = {
  "/api": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
  "/novelcreator.v1.": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 5173,
    proxy,
  },
});
