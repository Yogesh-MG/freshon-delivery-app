import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Stamp the bundle version at build time so the OTA updater knows what this
  // build shipped with. publish.sh exports BUNDLE_VERSION = the published
  // version; local/dev builds get a harmless dev fallback.
  define: {
    "import.meta.env.VITE_BUNDLE_VERSION": JSON.stringify(
      process.env.BUNDLE_VERSION ?? `dev-${process.env.npm_package_version ?? "0"}`,
    ),
  },
  // Tauri expects a fixed port and a clean console; fail instead of falling back.
  clearScreen: false,
  server: {
    host: host || "::",
    port: 1430,
    strictPort: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : {
          overlay: false,
        },
    fs: {
      allow: [
        // Allow serving files from one level up (workspace root)
        path.resolve(__dirname, ".."),
      ],
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Del_app doesn't depend on the shared SDK like the other apps, but the OTA
      // updater lives in it. Resolve the subpath to the package's built output.
      "@freshon/api": path.resolve(__dirname, "../packages/freshon-api/dist"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
