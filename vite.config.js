import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function copyMapLibreWorkerShared() {
  return {
    name: "copy-maplibre-worker-shared",
    writeBundle() {
      copyFileSync(
        resolve("node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs"),
        resolve("dist/assets/maplibre-gl-shared.mjs"),
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), copyMapLibreWorkerShared()],
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
});
