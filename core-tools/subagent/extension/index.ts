/**
 * DEPRECATED: subagent merged into subprocess-orchestrator in v0.6.0
 *
 * This module is kept for backward compatibility in v0.6.0.
 * It will be removed in v0.7.0.
 *
 * The subagent functionality is now part of SubprocessOrchestrationExtension.
 * Use the "subprocess" tool instead of the "subagent" tool.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED v0.6.0] subagent merged into subprocess-orchestrator\n" +
    "  Use: SubprocessOrchestrationExtension with action 'single', 'chain', 'bg'.\n" +
    "  The 'subprocess' tool replaces the 'subagent' tool.\n" +
    "  This adapter will be removed in v0.7.0.\n" +
    "  Migration: Use { action: 'single', cmd: '...' } via 'subprocess' tool.\n" +
    "  Guide: https://github.com/dmoreq/pi-me/releases/tag/v0.6.0"
  );
  // No-op: all execution now handled by subprocess-orchestrator
}
