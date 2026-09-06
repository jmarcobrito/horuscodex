import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { extractPreviewFonts } from "../helpers/preview-fonts.mjs";

// Only compiled CSS/font assets are read. No Next server, environment file or API.
export function previewFonts(root: string): Plugin {
  const chunks = join(root, ".next/static/chunks");
  const assets = new Map<string, Buffer>();
  let css: string | null = null;
  return {
    name: "isolated-preview-fonts",
    configureServer(server) {
      if (!existsSync(chunks)) {
        server.config.logger.warn("Ensaio sem fontes compiladas: execute a verificação isolada antes do QA visual.");
        return;
      }
      const result = extractPreviewFonts(readdirSync(chunks).filter(file => file.endsWith(".css"))
        .map(file => readFileSync(join(chunks, file), "utf8")).join("\n"));
      css = result.css;
      for (const file of result.files) assets.set("/__preview-fonts/" + file, readFileSync(join(root, ".next/static/media", file)));
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split("?")[0];
        const font = url ? assets.get(url) : undefined;
        if (url !== "/__preview-fonts.css" && !font) return next();
        response.setHeader("Content-Type", font ? "font/woff2" : "text/css; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(font ?? css);
      });
    },
    transformIndexHtml() {
      return css ? [{ tag: "link", attrs: { rel: "stylesheet", href: "/__preview-fonts.css" }, injectTo: "head" }] : [];
    },
  };
}
