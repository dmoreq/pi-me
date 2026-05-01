/**
 * pi-me: secrets — Secret obfuscation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { collectEnvSecrets, loadAllSecrets } from "./loader";
import { SecretObfuscator } from "./obfuscator";

export { SecretObfuscator } from "./obfuscator";
export { collectEnvSecrets, loadAllSecrets } from "./loader";
export type { SecretEntry, SecretsConfig } from "./types";

export default async function (pi: ExtensionAPI) {
	let obfuscator = new SecretObfuscator([]);

	pi.on("session_start", async (_event, ctx) => {
		const config = await loadAllSecrets(ctx.cwd);
		const envEntries = collectEnvSecrets();
		const allEntries = [...config.entries, ...envEntries];
		obfuscator = new SecretObfuscator(allEntries);
	});

	pi.on("tool_result", async (event, _ctx) => {
		if (!obfuscator.hasSecrets()) return;

		const newContent = event.content?.map((block) => {
			if (block.type === "text") {
				return { ...block, text: obfuscator.obfuscate(block.text) };
			}
			return block;
		});

		const newDetails = event.details != null
			? obfuscator.deobfuscateObject(
				JSON.parse(JSON.stringify(event.details, (key, value) =>
					typeof value === "string" ? obfuscator.obfuscate(value) : value
				))
			)
			: event.details;

		return {
			content: newContent,
			details: newDetails,
		};
	});

	pi.on("context", async (event, _ctx) => {
		if (!obfuscator.hasSecrets()) return;

		const messages = event.messages.map((msg) => {
			if (!Array.isArray(msg.content)) return msg;

			let changed = false;
			const content = msg.content.map((block: Record<string, unknown>) => {
				if (block.type === "text" && typeof block.text === "string") {
					const obfuscated = obfuscator.obfuscate(block.text);
					if (obfuscated !== block.text) {
						changed = true;
						return { ...block, text: obfuscated };
					}
				}
				return block;
			});

			return changed ? { ...msg, content } : msg;
		});

		return { messages };
	});
}
