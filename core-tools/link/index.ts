/**
 * pi-link — WebSocket inter-terminal communication for Pi.
 * Inlined from pi-link v0.1.11. Skills from pi-link-coordination.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import linkExtension from "./source/index.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI): void {
  // Register skill paths eagerly
  pi.on("resources_discover", async () => ({
    skillPaths: [join(__dirname, "skills")],
  }));

  pi.on("session_start", async (_event, ctx) => {
    try {
      linkExtension(pi);
      ctx.ui.setStatus("pi-link", "ready");
    } catch (err) {
      console.error("[pi-link] Failed to load:", err);
      ctx.ui.notify("pi-link failed to load", "error");
    }
  });
}
