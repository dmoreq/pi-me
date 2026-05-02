/**
 * @aliou/pi-processes — Process management for pi (run, monitor, bg jobs).
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@aliou/pi-processes"),
    statusKey: "pi-processes",
    packageName: "@aliou/pi-processes",
  });
