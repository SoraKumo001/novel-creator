import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.API_TARGET ?? "http://localhost:3000";

const proxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
  },
  "/novelcreator.v1.": {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [tanstackRouter(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@features/chat": path.resolve(
        import.meta.dirname,
        "./src/features/chat"
      ),
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
