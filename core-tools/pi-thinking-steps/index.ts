/**
 * pi-thinking-steps — Three-mode thinking-step rendering for Pi's TUI.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-thinking-steps"),
    statusKey: "pi-thinking-steps",
    packageName: "pi-thinking-steps",
  });
