/**
 * context-mode — MCP-based context window optimization for pi.
 * Adopted from context-mode v1.0.103.
 *
 * Registers skills eagerly (light metadata), defers full extension loading
 * to session_start.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Resolve skills directory eagerly (light metadata)
const extensionDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(extensionDir, "..", "..", "..", "node_modules", "context-mode", "skills");

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("context-mode/build/pi-extension.js"),
    statusKey: "context-mode",
    packageName: "context-mode",
    skillPaths: [skillsDir],
  });
