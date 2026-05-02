/**
 * pi-crew — Coordinated AI teams, workflows, worktrees, async task orchestration.
 * Lazy-loaded on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-crew");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-crew", "ready");
    } catch (err) {
      console.error("[pi-crew] Failed:", err);
    }
  });
}
