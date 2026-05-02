/**
 * pi-thinking-steps — Three-mode thinking-step rendering for Pi's TUI.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-thinking-steps");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-thinking-steps", "ready");
    } catch (err) {
      console.error("[pi-thinking-steps] Failed:", err);
    }
  });
}
