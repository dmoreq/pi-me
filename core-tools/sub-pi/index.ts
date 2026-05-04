/**
 * DEPRECATED: sub-pi merged into subprocess-orchestrator in v0.6.0
 *
 * This module is kept for backward compatibility in v0.6.0.
 * It will be removed in v0.7.0.
 *
 * The sub-pi functionality is now part of SubprocessOrchestrationExtension.
 * Use: subprocess action 'pi' instead.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED v0.6.0] sub-pi merged into subprocess-orchestrator\n" +
    "  Use: SubprocessOrchestrationExtension with action 'pi'.\n" +
    "  The 'subprocess' tool replaces the 'sub-pi' tool.\n" +
    "  This adapter will be removed in v0.7.0.\n" +
    "  Migration: Use { action: 'pi', prompt: '...' } via 'subprocess' tool.\n" +
    "  Guide: https://github.com/dmoreq/pi-me/releases/tag/v0.6.0"
  );
  // No-op: pi subprocess now handled by subprocess-orchestrator
}
