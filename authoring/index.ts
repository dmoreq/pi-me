/**
 * authoring — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: commit-helper.
 *
 * v0.5.0: Removed skill-bootstrap (merged into core-tools/memory as project-context scanner).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";
import commitHelper from "./commit-helper/commit-helper.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "authoring",
			version: "0.5.0",
			description: "Authoring helpers: commit-helper only (skill-bootstrap merged into memory)",
			tools: ["commit_message"],
		});
		t.heartbeat("authoring");
	}

	commitHelper(pi);
}
