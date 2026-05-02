/**
 * pi-mcp-adapter — MCP (Model Context Protocol) adapter for Pi.
 * Adopted from pi-mcp-adapter v2.5.3.
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-mcp-adapter"),
    statusKey: "pi-mcp",
    packageName: "pi-mcp-adapter",
  });
