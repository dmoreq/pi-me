/**
 * session-lifecycle — Umbrella entry point.
 *
 * Profile: dev / full (skipped for "minimal").
 * Registers: context-intel, checkpoint, welcome, skill-args.
 *
 * v0.5.0: Removed usage-extension (moved to foundation/context-monitor).
 *         Removed context-pruning (will be merged into context-intel as plugins).
 *         Removed session-name (will be merged into welcome/).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";

import { ContextIntelExtension } from "./context-intel";
import checkpoint from "./git-checkpoint/checkpoint.ts";
import contextPruning from "./context-pruning/index.ts";
import welcomeOverlay from "./welcome-overlay/index.ts";
import { registerSessionName } from "./session-name.ts";
import { registerArgsHandler } from "./skill-args.ts";

// Re-export for external consumers (backwards-compat)
export { parseCommandArgs, substituteArgs, handleInput, invalidateSkillIndex } from "./skill-args.ts";
export { sessionNameFromMessage } from "./session-name.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "session-lifecycle",
			version: "0.5.0",
			description: "Session lifecycle: context-intel, checkpoint, welcome, skill-args",
			events: ["session_start", "session_shutdown", "session_before_*"] as string[],
		});
		t.heartbeat("session-lifecycle");
	}

	// ContextIntelExtension handles handoff, auto-compact, session recap
	new ContextIntelExtension(pi).register();

	checkpoint(pi);
	void contextPruning(pi);
	registerSessionName(pi);
	welcomeOverlay(pi);
	registerArgsHandler(pi);
}
