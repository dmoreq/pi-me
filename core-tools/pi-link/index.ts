/**
 * pi-link — WebSocket inter-terminal communication for Pi.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-link"),
    statusKey: "pi-link",
    packageName: "pi-link",
  });
