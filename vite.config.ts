import { defineConfig } from "vite";

// @tauri-apps/cli sets TAURI_DEV_HOST when running on a device
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch the Rust backend
      ignored: ["**/src-tauri/**"],
    },
  },
  // Produce assets compatible with the WebView (Windows -> Chromium)
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
});
