/**
 * authoring — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: commit-helper, skill-bootstrap.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";
import commitHelper from "./commit-helper/commit-helper.ts";
import skillBootstrap from "./skill-bootstrap/skill-bootstrap.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "authoring",
			version: "0.2.0",
			description: "Authoring helpers: commit-helper, skill-bootstrap",
			tools: ["commit_message"],
		});
		t.heartbeat("authoring");
	}

	commitHelper(pi);
	skillBootstrap(pi);
}
