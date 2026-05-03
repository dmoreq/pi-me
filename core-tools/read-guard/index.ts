/**
 * Read-Before-Edit Guard — Extension entry.
 *
 * Hooks into tool_call events to record reads and check edits.
 * Blocks edits that lack adequate prior reading.
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { resolveFilePath } from "../../shared/path-utils.js";
import { ReadGuard } from "./guard.ts";

export default function (pi: ExtensionAPI) {
	const guard = new ReadGuard();

	// ── Command: /trust-me ─────────────────────────────────────────────

	pi.registerCommand("trust-me", {
		description:
			"Skip the read-before-edit guard for one edit to a file. Usage: /trust-me <path>",
		handler: async (_args, ctx) => {
			const rawTarget = Array.isArray(_args) ? _args[0] : String(_args ?? "");
			if (!rawTarget) {
				ctx.ui.notify("Just tell me the file path, like: `/trust-me some/file.ts` 😊", "info");
				return;
			}
			const targetPath = resolveFilePath(rawTarget, ctx.cwd);
			guard.addExemption(targetPath);
			ctx.ui.notify(`👍 Got it! I'll skip the read check for \`${targetPath}\` — just this once!`, "info");
		},
	});

	// ── Events ──────────────────────────────────────────────────────────

	pi.on("tool_call", (event) => {
		const ev = event as { toolName?: string; input?: Record<string, unknown> };
		const toolName = ev.toolName ?? "";
		const input = ev.input ?? {};

		// Track reads
		if (toolName === "read") {
			const filePath = (input.path as string) ?? (input.filePath as string);
			if (!filePath) return;
			const resolvedPath = resolveFilePath(filePath);
			if (!existsSync(resolvedPath)) return;

			const offset = (input.offset as number) ?? 1;
			const limit = (input.limit as number) ?? 1;
			guard.recordRead(resolvedPath, offset, limit);
			return;
		}

		// Check edits
		if (toolName === "edit") {
			const rawPath = (input.path as string) ?? "";
			if (!rawPath) return;
			const resolvedPath = resolveFilePath(rawPath);

			// Estimate touched lines from edits
			const edits = (input.edits as Array<{ oldText?: string }>) ?? [];
			const allOldText = edits.map((e) => e.oldText ?? "").join("\n");
			const lineCount = allOldText ? allOldText.split("\n").length : 0;

			const verdict = guard.checkEdit(
				resolvedPath,
				lineCount > 0 ? [1, lineCount] : undefined,
			);
			if (verdict.action === "block") {
				return { block: true, reason: verdict.reason };
			}
		}
	});

	// Reset guard state on new session
	pi.on("session_start", () => {
		guard.reset();
	});
}
