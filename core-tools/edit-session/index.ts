/**
 * pi-edit-session — Re-edit or delete earlier user messages.
 * Inlined from pi-edit-session-in-place v0.1.8.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import editSessionInPlace from "./extensions/edit-session-in-place.ts";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      editSessionInPlace(pi);
      ctx.ui.setStatus("pi-edit-session", "ready");
    } catch (err) {
      console.error("[pi-edit-session] Failed to load:", err);
      ctx.ui.notify("pi-edit-session failed to load", "error");
    }
  });
}
