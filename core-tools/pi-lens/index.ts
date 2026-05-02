/**
 * pi-lens — Real-time code feedback: LSP, linters, formatters, type-checking.
 * Adopted from pi-lens v3.8.34 by apmantza.
 *
 * PERFORMANCE-CRITICAL: pi-lens has heavy dependencies:
 *   - typescript (TS compiler, ~50MB)
 *   - @ast-grep/napi (native Rust binary, ~4MB)
 *   - tree-sitter-wasms + web-tree-sitter (WASM)
 *   - vscode-jsonrpc (LSP protocol)
 *
 * Strategy:
 *   - Skill registration happens eagerly (light metadata only)
 *   - Flags are registered eagerly (just strings)
 *   - The full pi-lens module is loaded via registerAdoptedPackage on session_start
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Eager skill discovery (light metadata, no binary loading)
const extensionDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(extensionDir, "..", "..", "..", "node_modules", "pi-lens", "skills");

export default function (pi: ExtensionAPI) {
  // Register skills eagerly
  pi.on("resources_discover", async () => ({ skillPaths: [skillsDir] }));

  // Eager flags — pi-lens reads these at CLI invocation, before session_start
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

  // Deferred load via shared helper (skillPaths omitted — already registered eagerly above)
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-lens"),
    statusKey: "pi-lens",
    packageName: "pi-lens",
  });
}
