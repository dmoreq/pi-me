/**
 * pi-docparser — Document parsing (PDF, Office, spreadsheets, images).
 * Adopted from pi-docparser v1.1.1.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-docparser"),
    statusKey: "pi-docparser",
    packageName: "pi-docparser",
  });
