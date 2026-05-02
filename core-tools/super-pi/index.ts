/**
 * @leing2021/super-pi — Compound Engineering package for iterative workflows.
 * Zero deps. Entry: extensions/ce-core/index.ts. Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@leing2021/super-pi/extensions/ce-core/index.ts");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("super-pi", "ready");
    } catch (err) {
      console.error("[super-pi] Failed:", err);
    }
  });
}
