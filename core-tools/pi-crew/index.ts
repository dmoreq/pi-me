/**
 * pi-crew — Coordinated AI teams, workflows, worktrees, async task orchestration.
 * Lazy-loaded on session_start.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-crew"),
    statusKey: "pi-crew",
    packageName: "pi-crew",
  });
