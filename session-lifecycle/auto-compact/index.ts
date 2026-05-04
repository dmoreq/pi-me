/**
 * DEPRECATED: auto-compact merged into context-intel in v0.3.0
 *
 * This module is kept for backward compatibility in v0.3.1.
 * It will be removed in v0.4.0.
 *
 * The auto-compact functionality is now part of ContextIntelExtension.
 * All features still work identically — no migration needed for users.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	console.warn(
		"[DEPRECATED v0.3.1] auto-compact merged into context-intel in v0.3.0\n" +
		"  The auto-compact functionality is now part of ContextIntelExtension.\n" +
		"  This adapter will be removed in v0.4.0.\n" +
		"  No action needed — compaction still works automatically.\n" +
		"  Migration guide: https://github.com/dmoreq/pi-me/releases/tag/v0.3.1"
	);

	// No-op: auto-compact is now handled by ContextIntelExtension
	// This is a deprecated stub kept for backward compatibility only
}
