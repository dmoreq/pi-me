/**
 * @fitchmultz/pi-stash — Stash draft messages and restore them later.
 * Entry: extensions/stash.ts. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@fitchmultz/pi-stash/extensions/stash.ts");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-stash", "ready");
    } catch (err) {
      console.error("[pi-stash] Failed:", err);
    }
  });
}
