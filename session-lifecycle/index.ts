/**
 * session-lifecycle — Umbrella entry point.
 *
 * Profile: dev / full (skipped for "minimal").
 * Registers: checkpoint, welcome, skill-args.
 *
 * v0.9.0: Removed context-intel (fully moved to pi-slim).
 * v0.5.0: Removed usage-extension (moved to foundation/context-monitor).
 *         Removed context-pruning (now a plugin inside context-intel).
 *         Merged welcome-overlay + session-name into welcome/ module.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";

import checkpoint from "./git-checkpoint/checkpoint.ts";
import welcome from "./welcome/welcome.ts";
import { registerArgsHandler } from "./skill-args.ts";

// Re-export for external consumers (backwards-compat)
export { parseCommandArgs, substituteArgs, handleInput, invalidateSkillIndex } from "./skill-args.ts";
export { sessionNameFromMessage } from "./welcome/welcome.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "session-lifecycle",
			version: "0.9.0",
			description: "Session lifecycle: checkpoint, welcome, skill-args",
			events: ["session_start", "session_shutdown", "session_before_*"] as string[],
		});
		t.heartbeat("session-lifecycle");
	}

	checkpoint(pi);
	welcome(pi); // merged: welcome-overlay + session-name
	registerArgsHandler(pi);
}
