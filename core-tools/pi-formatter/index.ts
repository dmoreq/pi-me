/**
 * pi-formatter — Auto-formats files on save/write.
 * Zero deps. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-formatter");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-formatter", "ready");
    } catch (err) {
      console.error("[pi-formatter] Failed:", err);
    }
  });
}
