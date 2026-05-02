/**
 * pi-studio — Two-pane browser workspace for prompt/response editing,
 * annotations, critiques, history, and live previews.
 * Adopted from pi-studio v0.6.9 by omacl.
 *
 * Heavy: 351KB index.ts, WebSocket server, browser-based UI.
 * Loaded via dynamic import on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-studio");
      if (typeof mod.default === "function") {
        await mod.default(pi);
      }
      ctx.ui.setStatus("pi-studio", "ready");
    } catch (err) {
      console.error("[pi-studio] Failed to load:", err);
      ctx.ui.notify(
        "pi-studio failed to load. Run: npm install pi-studio",
        "error",
      );
    }
  });
}
