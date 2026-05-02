/**
 * pi-lens — Real-time code feedback: LSP, linters, formatters, type-checking.
 * Adopted from pi-lens v3.8.34 by apmantza.
 *
 * PERFORMANCE-CRITICAL: pi-lens has heavy dependencies:
 *   - typescript (TS compiler, ~50MB)
 *   - @ast-grep/napi (native Rust binary, ~4MB)
 *   - tree-sitter-wasms + web-tree-sitter (WASM)
 *   - vscode-jsonrpc (LSP protocol)
 *   - 38KB+ of TypeScript source parsed by tsx
 *
 * Strategy:
 *   - Skill registration happens eagerly (light metadata only)
 *   - Flags are registered eagerly (just strings)
 *   - The full pi-lens module is dynamically imported inside session_start
 *     so heavy binaries (ast-grep, TS compiler, tree-sitter WASM) are
 *     loaded AFTER pi is fully initialized, never at extension load time.
 *
 * Result: pi startup time is unaffected. pi-lens initializes asynchronously
 * before the user sends their first prompt.
 */
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // === Eager: skill discovery (light metadata only, no binary loading) ===
  // Register pi-lens skills so the agent knows about ast-grep and lsp-navigation
  const extensionDir = dirname(fileURLToPath(import.meta.url));
  const skillsDir = join(extensionDir, "..", "..", "..", "node_modules", "pi-lens", "skills");
  pi.on("resources_discover", async () => ({
    skillPaths: [skillsDir],
  }));

  // === Eager: flags (light, just string metadata) ===
  // Defer actual flag registration to session_start to avoid needing to
  // import pi-lens eagerly. Instead, we register them here inline.
  // (pi-lens v3.8.34 registers 7 flags)
  const flags: Array<{ name: string; description: string; type: string; default?: boolean }> = [
    { name: "no-lsp", description: "Disable unified LSP diagnostics and use language-specific fallbacks", type: "boolean", default: false },
    { name: "no-autoformat", description: "Disable automatic formatting on file write", type: "boolean", default: false },
    { name: "no-autofix", description: "Disable auto-fixing of lint issues", type: "boolean", default: false },
    { name: "no-tests", description: "Disable test runner on write", type: "boolean", default: false },
    { name: "no-delta", description: "Disable delta mode (show all diagnostics, not just new ones)", type: "boolean", default: false },
    { name: "lens-guard", description: "Block git commit/push when unresolved pi-lens blockers exist", type: "boolean", default: false },
    { name: "no-read-guard", description: "Disable read-before-edit behavior monitor", type: "boolean", default: false },
  ];
  for (const flag of flags) {
    pi.registerFlag(flag.name, flag as any);
  }

  // === Deferred: session_start — load the real pi-lens module ===
  pi.on("session_start", async (_event, ctx) => {
    try {
      const piLensMod = await import("pi-lens");
      if (typeof piLensMod.default === "function") {
        await piLensMod.default(pi);
      }
      ctx.ui.setStatus("pi-lens", "ready");
    } catch (err) {
      console.error("[pi-lens] Failed to load:", err);
      ctx.ui.notify(
        "pi-lens failed to load. Run: npm install pi-lens",
        "error",
      );
    }
  });
}
