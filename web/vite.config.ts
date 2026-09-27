import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin /api in dev, exactly like the Cloudflare Worker does in production.
      proxy: { "/api": { target: apiTarget, rewrite: (p) => p.replace(/^\/api/, "") } },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target: apiTarget, rewrite: (p) => p.replace(/^\/api/, "") } },
    },
    build: {
      target: "es2022",
      // three.js (~900 kB) is only reached through the lazily imported DiveCanvas.
      chunkSizeWarningLimit: 1000,
    },
  };
});
