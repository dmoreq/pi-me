/**
 * @aliou/pi-processes — Process management for pi (run, monitor, bg jobs).
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@aliou/pi-processes");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-processes", "ready");
    } catch (err) {
      console.error("[pi-processes] Failed:", err);
    }
  });
}
