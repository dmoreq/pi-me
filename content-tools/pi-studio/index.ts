/**
 * pi-studio — Two-pane browser workspace for prompt/response editing.
 * Adopted from pi-studio v0.6.9.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-studio"),
    statusKey: "pi-studio",
    packageName: "pi-studio",
  });
