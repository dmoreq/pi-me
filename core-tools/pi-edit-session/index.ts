/**
 * pi-edit-session-in-place — Re-edit or delete earlier user messages.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-edit-session-in-place/extensions/edit-session-in-place.ts"),
    statusKey: "pi-edit-session",
    packageName: "pi-edit-session-in-place",
  });
