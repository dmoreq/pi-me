/**
 * greedysearch-pi — Multi-engine AI search via browser automation.
 * Inlined from @apmantza/greedysearch-pi v1.8.5.
 * Keeps jsdom, @mozilla/readability, turndown as deps.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import greedySearchExtension from "./source.ts";

const __dir = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI): void {
  pi.on("resources_discover", async () => ({
    skillPaths: [join(__dir, "skills")],
  }));

  pi.on("session_start", async (_event, ctx) => {
    try {
      greedySearchExtension(pi);
      ctx.ui.setStatus("greedysearch", "ready");
    } catch (err) {
      console.error("[greedysearch] Failed to load:", err);
      ctx.ui.notify("greedysearch-pi failed to load", "error");
    }
  });
}
