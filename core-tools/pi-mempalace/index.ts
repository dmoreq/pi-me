/**
 * pi-mempalace-extension — Lean MemPalace integration for Pi.
 * Entry: dist/pi-extension.js. Lazy-loaded on session_start.
 */
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-mempalace-extension/dist/pi-extension.js");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-mempalace", "ready");
    } catch (err) {
      console.error("[pi-mempalace] Failed:", err);
    }
  });
}
