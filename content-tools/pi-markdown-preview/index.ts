/**
 * pi-markdown-preview — Rendered markdown + LaTeX preview.
 * Adopted from pi-markdown-preview v0.9.7.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-markdown-preview"),
    statusKey: "pi-markdown-preview",
    packageName: "pi-markdown-preview",
  });
