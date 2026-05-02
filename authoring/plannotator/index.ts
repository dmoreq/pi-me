/**
 * @plannotator/pi-extension — Interactive plan review with visual annotation.
 * Adopted from @plannotator/pi-extension v0.19.6.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@plannotator/pi-extension"),
    statusKey: "plannotator",
    packageName: "@plannotator/pi-extension",
  });
