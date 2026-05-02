/**
 * pi-mcp-adapter — MCP (Model Context Protocol) adapter for Pi.
 * Adopted from pi-mcp-adapter v2.5.3 by nicopreme.
 *
 * Lazy-loaded on session_start: the MCP SDK and all server connections
 * are initialized after pi is fully ready, not at extension module load.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Defer full MCP adapter initialization to session_start.
  // The underlying package registers tools, commands, and lifecycle hooks
  // via its own default export. We delay the entire import so the MCP SDK
  // and all server connections start after pi is ready.
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mcpMod = await import("pi-mcp-adapter");
      if (typeof mcpMod.default === "function") {
        await mcpMod.default(pi);
      }
      ctx.ui.setStatus("pi-mcp", "MCP adapter ready");
    } catch (err) {
      console.error("[pi-mcp-adapter] Failed to load:", err);
      ctx.ui.notify(
        "pi-mcp-adapter failed to load. Run: npm install pi-mcp-adapter",
        "error",
      );
    }
  });
}
