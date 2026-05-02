/**
 * @fitchmultz/pi-stash — Stash draft messages and restore them later.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@fitchmultz/pi-stash/extensions/stash.ts"),
    statusKey: "pi-stash",
    packageName: "@fitchmultz/pi-stash",
  });
