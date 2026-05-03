/**
 * foundation — Umbrella entry point.
 *
 * Always loaded (all profiles include foundation).
 * Registers: secrets, permission, safe-ops, context-window.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import secrets from "./secrets/secrets.ts";
import permission from "./permission/permission.ts";
import safeOps from "./safe-ops.ts";
import contextWindow from "./context-window/context-window.ts";

export default function (pi: ExtensionAPI) {
	const t = getTelemetry();
	if (t) {
		t.register({
			name: "foundation",
			version: "0.2.0",
			description: "Safety guards: secrets, permission, safe-ops, context-window",
			tools: ["read", "edit", "write", "bash"],
			events: ["tool_call", "input", "session_start", "session_shutdown"],
		});
		t.heartbeat("foundation");
	}

	// secrets is async — fire-and-forget, same as when it was a standalone entry
	void secrets(pi);
	permission(pi);
	safeOps(pi);
	contextWindow(pi);
}
