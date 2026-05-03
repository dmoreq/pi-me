/**
 * content-tools — Umbrella entry point.
 *
 * Profile: full only.
 * Imports: github, repeat, files-widget, file-picker, web-fetch.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.js";
import github from "./github.ts";
import repeat from "./repeat/repeat.ts";
import filesWidget from "./files-widget/index.ts";
import filePicker from "./file-picker/index.ts";
import webFetch from "./web-fetch/index.ts";

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile !== "full") return;

	github(pi);
	repeat(pi);
	filesWidget(pi);
	filePicker(pi);
	webFetch(pi);
}
