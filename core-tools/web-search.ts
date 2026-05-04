/**
 * DEPRECATED: web-search merged into web-tools in v0.6.0
 *
 * This module is kept for backward compatibility in v0.6.0.
 * It will be removed in v0.7.0.
 *
 * Web search is now part of WebToolsExtension.
 * Use: WebToolsExtension.search() or the 'web_search' tool instead.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED v0.6.0] web-search merged into web-tools\n" +
    "  Use: WebToolsExtension.search() or the 'web_search' tool.\n" +
    "  This adapter will be removed in v0.7.0.\n" +
    "  Migration: No change needed — the 'web_search' tool still works through web-tools.\n" +
    "  Guide: https://github.com/dmoreq/pi-me/releases/tag/v0.6.0"
  );
  // No-op: web search now handled by web-tools
}
