/**
 * DEPRECATED: session-recap merged into context-intel in v0.3.0
 *
 * This module is kept for backward compatibility in v0.3.1.
 * It will be removed in v0.4.0.
 *
 * The session-recap functionality is now part of ContextIntelExtension.
 * All features still work identically — no migration needed for users.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	console.warn(
		"[DEPRECATED v0.3.1] session-recap merged into context-intel in v0.3.0\n" +
		"  Use: /recap — same interface, better integration.\n" +
		"  This adapter will be removed in v0.4.0.\n" +
		"  Migration: No changes needed, command still works.\n" +
		"  Migration guide: https://github.com/dmoreq/pi-me/releases/tag/v0.3.1"
	);

	// No-op: session-recap is now handled by ContextIntelExtension
	// The /recap command is already registered by context-intel
	// This is a deprecated stub kept for backward compatibility only
}
