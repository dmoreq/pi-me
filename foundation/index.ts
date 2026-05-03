/**
 * foundation — Umbrella entry point.
 *
 * Always loaded (all profiles include foundation).
 * Registers: secrets, permission, safe-ops, context-window.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import secrets from "./secrets/secrets.ts";
import permission from "./permission/permission.ts";
import safeOps from "./safe-ops.ts";
import contextWindow from "./context-window/context-window.ts";

export default function (pi: ExtensionAPI) {
	// secrets is async — fire-and-forget, same as when it was a standalone entry
	void secrets(pi);
	permission(pi);
	safeOps(pi);
	contextWindow(pi);
}
