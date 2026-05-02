/**
 * pi-stash — Stash draft messages and restore them later.
 * Inlined from @fitchmultz/pi-stash v0.1.9.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piStash from "./extensions/stash.ts";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      piStash(pi);
      ctx.ui.setStatus("pi-stash", "ready");
    } catch (err) {
      console.error("[pi-stash] Failed to load:", err);
      ctx.ui.notify("pi-stash failed to load", "error");
    }
  });
}
