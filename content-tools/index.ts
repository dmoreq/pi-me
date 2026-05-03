/**
 * content-tools — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: github, repeat, files-widget, file-picker, web-fetch.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";
import github from "./github.ts";
import repeat from "./repeat/repeat.ts";
import filesWidget from "./files-widget/index.ts";
import filePicker from "./file-picker/index.ts";
import webFetch from "./web-fetch/index.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "content-tools",
			version: "0.2.0",
			description: "Content tools: web-fetch, repeat, files-widget, file-picker, github",
			tools: ["web_fetch", "batch_web_fetch", "repeat", "github", "readfiles"],
		});
		t.heartbeat("content-tools");
	}

	github(pi);
	repeat(pi);
	filesWidget(pi);
	filePicker(pi);
	webFetch(pi);
}
