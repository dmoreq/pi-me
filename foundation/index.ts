/**
 * foundation — Umbrella entry point.
 *
 * Always loaded (all profiles include foundation).
 * Registers: secrets, permission (3-layer guard: safety + tiers + safe-ops),
 *            context-monitor (merged context-window + usage-extension).
 *
 * v0.4.0: Merged safe-ops.ts into permission/ as SafeOpsLayer (Layer 3).
 * v0.5.0: Merged context-window + usage-extension → context-monitor.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import secrets from "./secrets/secrets.ts";
import permission from "./permission/permission.ts";
import contextMonitor from "./context-monitor/context-monitor.ts";

export default function (pi: ExtensionAPI) {
	const t = getTelemetry();
	if (t) {
		t.register({
			name: "foundation",
			version: "0.5.0",
			description: "Safety guards: secrets, permission (3-layer), context-monitor",
			tools: ["read", "edit", "write", "bash"],
			events: ["tool_call", "input", "session_start", "session_shutdown"],
		});
		t.heartbeat("foundation");
	}

	// secrets is async — fire-and-forget
	void secrets(pi);
	permission(pi);
	contextMonitor(pi);
}
