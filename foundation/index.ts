/**
 * foundation — Umbrella entry point.
 *
 * Always loaded (all profiles include foundation).
 * Registers: secrets, permission (3-layer guard: safety + tiers + safe-ops),
 *            context-window (will be renamed to context-monitor in Phase 2).
 *
 * v0.4.0: Merged safe-ops.ts into permission/ as SafeOpsLayer (Layer 3).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import secrets from "./secrets/secrets.ts";
import permission from "./permission/permission.ts";
import contextWindow from "./context-window/context-window.ts";

export default function (pi: ExtensionAPI) {
	const t = getTelemetry();
	if (t) {
		t.register({
			name: "foundation",
			version: "0.3.0",
			description: "Safety guards: secrets, permission (3-layer), context-window",
			tools: ["read", "edit", "write", "bash"],
			events: ["tool_call", "input", "session_start", "session_shutdown"],
		});
		t.heartbeat("foundation");
	}

	// secrets is async — fire-and-forget, same as when it was a standalone entry
	void secrets(pi);
	permission(pi);
	contextWindow(pi);
}
