/**
 * pi-me: output-artifacts — Artifact storage for truncated tool output.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const MAX_OUTPUT_CHARS = 8000;
const ARTIFACTS_DIR = ".pi/artifacts";

function truncateOutput(text: string, maxChars: number): { truncated: string; full: string; wasTruncated: boolean } {
	if (text.length <= maxChars) return { truncated: text, full: text, wasTruncated: false };
	const head = Math.floor(maxChars * 0.7);
	const tail = maxChars - head;
	return { truncated: `${text.slice(0, head)}\n\n... [${text.length - maxChars} more chars] ...\n\n${text.slice(-tail)}`, full: text, wasTruncated: true };
}

interface ArtifactRecord { id: string; toolName: string; timestamp: number; originalSize: number; }

export function registerOutputArtifacts(pi: ExtensionAPI) {
	const artifacts = new Map<string, ArtifactRecord>();

	pi.on("session_start", async () => { artifacts.clear(); });

	pi.on("tool_result", async (event, ctx) => {
		if (!event.content) return;

		let changed = false;
		const newContent = await Promise.all(event.content.map(async (block) => {
			if (block.type !== "text") return block;
			const { truncated, full, wasTruncated } = truncateOutput(block.text, MAX_OUTPUT_CHARS);
			if (!wasTruncated) return block;

			changed = true;
			const id = `${event.toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			const artifactPath = path.join(ctx.cwd, ARTIFACTS_DIR, `${id}.txt`);
			try { await fs.mkdir(path.dirname(artifactPath), { recursive: true }); await fs.writeFile(artifactPath, full, "utf-8"); } catch { return { ...block, text: truncated }; }

			artifacts.set(id, { id, toolName: event.toolName, timestamp: Date.now(), originalSize: full.length });
			return { ...block, text: truncated + `\n\n[Full ${event.toolName} output (${full.length} chars) saved to artifact://${id}]` };
		}));

		if (changed) return { content: newContent };
	});

	pi.on("before_agent_start", async (event, _ctx) => {
		if (artifacts.size === 0) return;

		const list = [...artifacts.values()].map((a) => `  artifact://${a.id} — ${a.toolName} output (${a.originalSize} chars)`);
		const instructions = ["", "## Artifact Storage", "Some tool outputs were truncated. Full outputs are available as artifacts:", ...list, "To read an artifact, use the read tool with the artifact:// URL:", "  read({ path: \"artifact://<id>\" })", ""].join("\n");

		return { systemPrompt: (event.systemPrompt ?? "") + instructions };
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "read") return;

		const input = event.input as { path?: string };
		if (!input.path?.startsWith("artifact://")) return;

		const id = input.path.slice("artifact://".length);
		const record = artifacts.get(id);
		if (!record) return { block: true, reason: `Artifact ${id} not found (may have expired)` };

		const artifactPath = path.join(ctx.cwd, ARTIFACTS_DIR, `${id}.txt`);
		try { await fs.readFile(artifactPath, "utf-8"); input.path = artifactPath; } catch { return { block: true, reason: `Artifact file missing: ${id}` }; }
	});
}

export default registerOutputArtifacts;
