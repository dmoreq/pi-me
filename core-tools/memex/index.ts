/**
 * @touchskyer/memex — Zettelkasten-based agent memory with bidirectional links.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@touchskyer/memex/pi-extension/index.ts"),
    statusKey: "memex",
    packageName: "@touchskyer/memex",
  });
