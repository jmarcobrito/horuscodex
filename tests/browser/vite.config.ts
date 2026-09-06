import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { previewFonts } from "./preview-fonts";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)), envDir: false, envPrefix: [], plugins: [react(), previewFonts(fileURLToPath(new URL("../..", import.meta.url)))],
  server: { host: "127.0.0.1", port: 4175, strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
    headers: { "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws://127.0.0.1:4175; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'none'; base-uri 'none'" },
  },
});
