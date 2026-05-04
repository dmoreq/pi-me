/**
 * content-tools — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: github, repeat, file-picker, web-fetch, web-tools.
 *
 * v0.4.0: Removed files-widget (dead extension from v0.3.0)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";
import github from "./github.ts";
import repeat from "./repeat/repeat.ts";
import filePicker from "./file-picker/index.ts";
import webTools from "./web-tools/index.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "content-tools",
			version: "0.3.0",
			description: "Content tools: web-tools, repeat, file-picker, github (v0.4.0: merged web-fetch into web-tools)",
			tools: ["web_fetch", "batch_web_fetch", "web_search", "repeat", "github"],
		});
		t.heartbeat("content-tools");
	}

	github(pi);
	repeat(pi);
	filePicker(pi);
	webTools(pi);
}
