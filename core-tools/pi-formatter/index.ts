/**
 * pi-formatter — Auto-formats files on save/write.
 * Zero deps. Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-formatter"),
    statusKey: "pi-formatter",
    packageName: "pi-formatter",
  });
