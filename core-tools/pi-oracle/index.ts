/**
 * pi-oracle — ChatGPT web-oracle with isolated browser auth, async jobs.
 * Entry: extensions/oracle/index.ts. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-oracle/extensions/oracle/index.ts");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-oracle", "ready");
    } catch (err) {
      console.error("[pi-oracle] Failed:", err);
    }
  });
}
