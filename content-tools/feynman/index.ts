/**
 * @companion-ai/feynman — Research-first CLI agent for Pi.
 * Adopted from @companion-ai/feynman v0.2.40.
 *
 * Registers skills eagerly (light metadata), defers extension loading
 * to session_start.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Resolve skills directory eagerly (light metadata)
const extensionDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(extensionDir, "..", "..", "..", "node_modules", "@companion-ai", "feynman", "skills");

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@companion-ai/feynman/extensions/research-tools.ts"),
    statusKey: "feynman",
    packageName: "@companion-ai/feynman",
    skillPaths: [skillsDir],
  });
