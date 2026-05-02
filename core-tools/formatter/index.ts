/**
 * formatter — Auto-formats files on save/write.
 * Inlined from formatter v1.1.2. Zero npm deps.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piFormatter from "./extensions/index.ts";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      piFormatter(pi);
      ctx.ui.setStatus("formatter", "ready");
    } catch (err) {
      console.error("[formatter] Failed to load:", err);
      ctx.ui.notify("formatter failed to load", "error");
    }
  });
}
