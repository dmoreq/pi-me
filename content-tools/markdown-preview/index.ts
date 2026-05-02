/**
 * pi-markdown-preview — Rendered markdown + LaTeX preview.
 * Inlined from pi-markdown-preview v0.9.7. Keeps puppeteer-core as dep.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piMarkdownPreview from "./source.ts";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      piMarkdownPreview(pi);
      ctx.ui.setStatus("pi-markdown-preview", "ready");
    } catch (err) {
      console.error("[pi-markdown-preview] Failed to load:", err);
      ctx.ui.notify("pi-markdown-preview failed to load", "error");
    }
  });
}
