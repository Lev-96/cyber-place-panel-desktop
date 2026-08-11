import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// Single source of truth for the running version. package.json is already the
// value CI matches the release tag against, so reading it here means the
// version reported by telemetry can never drift from the version that was
// actually shipped.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
  server: { port: 5173, strictPort: true },
});
