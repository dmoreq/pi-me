/**
 * foundation — Umbrella entry point.
 *
 * Always loaded (all profiles include foundation).
 * Registers: secrets, context-monitor (merged context-window + usage-extension).
 *
 * v0.5.0: Merged context-window + usage-extension → context-monitor.
 * v1.1.0: Removed permission (3-layer guard) — no longer part of foundation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import secrets from "./secrets/secrets.ts";
import contextMonitor from "./context-monitor/index.ts";

export default function (pi: ExtensionAPI) {
	const t = getTelemetry();
	if (t) {
		t.register({
			name: "foundation",
			version: "0.5.0",
			description: "Safety guards: secrets, context-monitor",
			tools: ["read", "edit", "write", "bash"],
			events: ["tool_call", "input", "session_start", "session_shutdown"],
		});
		t.heartbeat("foundation");
	}

	// secrets is async — fire-and-forget
	void secrets(pi);
	contextMonitor(pi);
}
