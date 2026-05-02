/**
 * @touchskyer/memex — Zettelkasten-based agent memory with bidirectional links.
 * Heavy: @modelcontextprotocol/sdk. Lazy-loaded on session_start.
 * Extension entry: pi-extension/index.ts
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@touchskyer/memex/pi-extension/index.ts");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("memex", "ready");
    } catch (err) {
      console.error("[memex] Failed:", err);
    }
  });
}
