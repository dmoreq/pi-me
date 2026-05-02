/**
 * @apmantza/greedysearch-pi — Multi-engine AI search (Perplexity, Bing Copilot, Google AI)
 * via browser automation — no API keys needed.
 * Debs: jsdom, @mozilla/readability, turndown. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@apmantza/greedysearch-pi");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("greedysearch", "ready");
    } catch (err) {
      console.error("[greedysearch] Failed:", err);
    }
  });
}
