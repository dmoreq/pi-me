/**
 * authoring — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: commit-helper, skill-bootstrap.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.js";
import commitHelper from "./commit-helper/commit-helper.ts";
import skillBootstrap from "./skill-bootstrap/skill-bootstrap.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	commitHelper(pi);
	skillBootstrap(pi);
}
