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
        port: 8100,
        strictPort: true,
        // NO_HMR=1 turns hot reload off entirely. Over a flaky link the HMR
        // socket drops and every reconnect force-reloads the page, which wipes
        // in-progress app state (a half-entered OTP, an open proof drawer).
        hmr: process.env.NO_HMR
            ? false
            : host
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
        /**
         * Same-origin path to the backend for dev on a device. The API's CORS
         * allowlist only carries localhost origins, so a phone or LAN browser
         * pointed at the dev server can't call it directly — set
         * VITE_API_URL=/ (e.g. in .env.local) and requests ride through here.
         */
        proxy: {
            "/api": {
                target: process.env.DEV_API_PROXY_TARGET || "https://api.freshon.in",
                changeOrigin: true,
            },
            "/ws": {
                target: process.env.DEV_API_PROXY_TARGET || "https://api.freshon.in",
                changeOrigin: true,
                ws: true,
            },
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
