/**
 * pi-me: session-name — Automatic session naming.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const MAX_NAME_LENGTH = 60;

function sessionNameFromMessage(text: string): string {
	let cleaned = text.replace(/^\/\S+\s*/, "").trim();
	if (!cleaned) cleaned = text.replace(/^\//, "").trim();
	if (cleaned.length > MAX_NAME_LENGTH) {
		const truncated = cleaned.slice(0, MAX_NAME_LENGTH);
		const lastSpace = truncated.lastIndexOf(" ");
		cleaned = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
	}
	return cleaned || `Session ${new Date().toLocaleDateString()}`;
}

export default function (pi: ExtensionAPI) {
	let firstMessageSeen = false;

	pi.on("session_start", async (_event, ctx) => {
		firstMessageSeen = false;
		const existingName = pi.getSessionName();
		if (existingName && ctx.hasUI) {
			firstMessageSeen = true;
			ctx.ui.setStatus("session-name", `Session: ${existingName}`);
		}
	});

	pi.on("input", async (event, ctx) => {
		if (firstMessageSeen) return { action: "continue" };
		if (!event.text.trim()) return { action: "continue" };

		firstMessageSeen = true;
		const name = sessionNameFromMessage(event.text);
		pi.setSessionName(name);

		if (ctx.hasUI) {
			ctx.ui.setStatus("session-name", `Session: ${name}`);
		}

		return { action: "continue" };
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		firstMessageSeen = false;
		if (ctx.hasUI) ctx.ui.setStatus("session-name", "");
	});
}
