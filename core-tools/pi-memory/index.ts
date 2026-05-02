/**
 * pi-memory — Persistent memory across sessions.
 * Adopted from @samfp/pi-memory v1.0.2.
 *
 * Learns corrections, preferences, and patterns from sessions.
 * Injects relevant memory into future conversations.
 *
 * Lazy-loaded on session_start so it never slows pi startup.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  // Defer loading the actual package to session_start.
  // The package registers tools, commands, and lifecycle hooks
  // via its own default export, which we call after the dynamic import.
  pi.on("session_start", async (_event, ctx) => {
    try {
      const memoryMod = await import("@samfp/pi-memory");
      if (typeof memoryMod.default === "function") {
        await memoryMod.default(pi);
      }
      ctx.ui.setStatus("pi-memory", "ready");
    } catch (err) {
      console.error("[pi-memory] Failed to load:", err);
      ctx.ui.notify("pi-memory failed to load. Run: npm install @samfp/pi-memory", "error");
    }
  });
}
