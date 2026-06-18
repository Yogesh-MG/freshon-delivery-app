import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
