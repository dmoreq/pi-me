/**
 * content-tools — Umbrella entry point.
 *
 * Profile: full only.
 * Registers: github, repeat, web-tools tools.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.ts";
import github from "./github.ts";
import repeat from "./repeat/repeat.ts";
import webTools from "./web-tools/index.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "content-tools",
			version: "0.5.0",
			description: "Content tools: web-tools, repeat, github",
			tools: ["web_fetch", "batch_web_fetch", "web_search", "repeat", "github"],
		});
		t.heartbeat("content-tools");
	}

	github(pi);
	repeat(pi);
	webTools(pi);
}
