/**
 * pi-link — WebSocket inter-terminal communication for Pi.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-link");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-link", "ready");
    } catch (err) {
      console.error("[pi-link] Failed:", err);
    }
  });
}
