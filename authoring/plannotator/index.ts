/**
 * @plannotator/pi-extension — Interactive plan review with visual annotation.
 * Adopted from @plannotator/pi-extension v0.19.6 by backnotprop.
 *
 * Provides plan mode, browser-based annotation, and code review workflows.
 * Lazy-loaded on session_start to defer package parse and heavy imports.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const plannotatorMod = await import("@plannotator/pi-extension");
      if (typeof plannotatorMod.default === "function") {
        await plannotatorMod.default(pi);
      }
      ctx.ui.setStatus("plannotator", "ready");
    } catch (err) {
      console.error("[plannotator] Failed to load:", err);
      ctx.ui.notify(
        "plannotator failed to load. Run: npm install @plannotator/pi-extension",
        "error",
      );
    }
  });
}
