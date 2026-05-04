/**
 * DEPRECATED: web-fetch merged into web-tools in v0.6.0
 *
 * This module is kept for backward compatibility in v0.6.0.
 * It will be removed in v0.7.0.
 *
 * Web fetch is now part of WebToolsExtension.
 * Use: WebToolsExtension.fetch() or the 'web_fetch' tool instead.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED v0.6.0] web-fetch merged into web-tools\n" +
    "  Use: WebToolsExtension.fetch() or the 'web_fetch' tool.\n" +
    "  This adapter will be removed in v0.7.0.\n" +
    "  Migration: No change needed — the 'web_fetch' tool still works through web-tools.\n" +
    "  Guide: https://github.com/dmoreq/pi-me/releases/tag/v0.6.0"
  );
  // No-op: web fetch now handled by web-tools
}
