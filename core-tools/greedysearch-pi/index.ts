/**
 * @apmantza/greedysearch-pi — Multi-engine AI search via browser automation.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@apmantza/greedysearch-pi"),
    statusKey: "greedysearch",
    packageName: "@apmantza/greedysearch-pi",
  });
