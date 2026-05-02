/**
 * pi-edit-session-in-place — Re-edit or delete earlier user messages.
 * Entry: extensions/edit-session-in-place.ts. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-edit-session-in-place/extensions/edit-session-in-place.ts");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-edit-session", "ready");
    } catch (err) {
      console.error("[pi-edit-session] Failed:", err);
    }
  });
}
