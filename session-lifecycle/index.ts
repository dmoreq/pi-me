/**
 * session-lifecycle — Umbrella entry point.
 *
 * Profile: dev / full (skipped for "minimal").
 * Registers: handoff, checkpoint, auto-compact, context-pruning,
 *             session-recap, usage, welcome, session-name, skill-args.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";

import handoff from "./handoff.ts";
import checkpoint from "./git-checkpoint/checkpoint.ts";
import autoCompact from "./auto-compact/index.ts";
import contextPruning from "./context-pruning/index.ts";
import sessionRecap from "./session-recap/index.ts";
import usageExtension from "./usage-extension/index.ts";
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
			version: "0.3.0",
			description: "Session lifecycle: handoff, checkpoint, auto-compact, context-pruning, session-recap, usage, welcome",
			events: ["session_start", "session_shutdown", "session_before_*"] as string[],
		});
		t.heartbeat("session-lifecycle");
	}

	handoff(pi);
	checkpoint(pi);
	autoCompact(pi);
	void contextPruning(pi);
	registerSessionName(pi);
	sessionRecap(pi);
	usageExtension(pi);
	welcomeOverlay(pi);
	registerArgsHandler(pi);
}
