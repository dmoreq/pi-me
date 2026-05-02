/**
 * pi-memory — Persistent memory across sessions.
 * Adopted from @samfp/pi-memory v1.0.2.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@samfp/pi-memory"),
    statusKey: "pi-memory",
    packageName: "@samfp/pi-memory",
  });
