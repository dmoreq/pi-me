/**
 * pi-markdown-preview — Rendered markdown + LaTeX preview for terminal,
 * browser, and PDF output. Adopted from pi-markdown-preview v0.9.7 by omacl.
 *
 * Heavy dependency: puppeteer-core (~30MB, launches Chrome/Puppeteer).
 * Entire module loaded via dynamic import on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-markdown-preview");
      if (typeof mod.default === "function") {
        await mod.default(pi);
      }
      ctx.ui.setStatus("pi-markdown-preview", "ready");
    } catch (err) {
      console.error("[pi-markdown-preview] Failed to load:", err);
      ctx.ui.notify(
        "pi-markdown-preview failed. Run: npm install pi-markdown-preview",
        "error",
      );
    }
  });
}
