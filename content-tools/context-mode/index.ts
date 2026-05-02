/**
 * context-mode — MCP-based context window optimization for pi.
 * Adopted from context-mode v1.0.103 by mksglu.
 *
 * Saves context window via sandboxed code execution, FTS5 knowledge base,
 * and intent-driven search. Heavy dependencies: @modelcontextprotocol/sdk,
 * @mixmark-io/domino, turndown, etc.
 *
 * Loaded on session_start. Skill paths registered eagerly.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Register skill paths eagerly (light metadata only)
  const extDir = dirname(fileURLToPath(import.meta.url));
  const pkgDir = join(extDir, "..", "..", "..", "node_modules", "context-mode");
  pi.on("resources_discover", async () => ({
    skillPaths: [join(pkgDir, "skills")],
  }));

  // Defer full extension init to session_start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("context-mode/build/pi-extension.js");
      if (typeof mod.default === "function") {
        await mod.default(pi);
      }
      ctx.ui.setStatus("context-mode", "ready");
    } catch (err) {
      console.error("[context-mode] Failed to load:", err);
      ctx.ui.notify(
        "context-mode failed to load. Run: npm install context-mode",
        "error",
      );
    }
  });
}
