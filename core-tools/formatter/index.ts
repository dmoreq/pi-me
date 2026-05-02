/**
 * pi-formatter — Auto-formats files on save/write.
 * Inlined from pi-formatter v1.1.2. Zero npm deps.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piFormatter from "./extensions/index.ts";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      piFormatter(pi);
      ctx.ui.setStatus("pi-formatter", "ready");
    } catch (err) {
      console.error("[pi-formatter] Failed to load:", err);
      ctx.ui.notify("pi-formatter failed to load", "error");
    }
  });
}
