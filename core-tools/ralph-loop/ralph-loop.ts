/**
 * DEPRECATED: ralph-loop merged into subprocess-orchestrator in v0.6.0
 *
 * This module is kept for backward compatibility in v0.6.0.
 * It will be removed in v0.7.0.
 *
 * The loop execution functionality is now part of SubprocessOrchestrationExtension.
 * Use: subprocess action 'loop' instead.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED v0.6.0] ralph-loop merged into subprocess-orchestrator\n" +
    "  Use: SubprocessOrchestrationExtension with action 'loop'.\n" +
    "  The 'subprocess' tool replaces the 'ralph-loop' tool.\n" +
    "  This adapter will be removed in v0.7.0.\n" +
    "  Migration: Use { action: 'loop', task: '...', conditionCmd: '...' } via 'subprocess' tool.\n" +
    "  Guide: https://github.com/dmoreq/pi-me/releases/tag/v0.6.0"
  );
  // No-op: loop execution now handled by subprocess-orchestrator
}
