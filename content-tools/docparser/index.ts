/**
 * pi-docparser — Document parsing (PDF, Office, spreadsheets, images).
 * Inlined from pi-docparser v1.1.1. Keeps @llamaindex/liteparse as dep.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import piDocparser from "./extensions/docparser/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI): void {
  // Register skill paths eagerly
  pi.on("resources_discover", async () => ({
    skillPaths: [join(__dirname, "skills")],
  }));

  pi.on("session_start", async (_event, ctx) => {
    try {
      piDocparser(pi);
      ctx.ui.setStatus("pi-docparser", "ready");
    } catch (err) {
      console.error("[pi-docparser] Failed to load:", err);
      ctx.ui.notify("pi-docparser failed to load", "error");
    }
  });
}
