/**
 * Auto-Fix Pipeline — Extension entry.
 *
 * Runs lint auto-fix tools (Biome --write, ESLint --fix, Ruff --fix)
 * on files after write or edit tool calls.
 *
 * Works alongside the formatter extension — this is the "fix" step
 * that follows the "format" step. Designed as a lightweight companion,
 * not a replacement for the formatter.
 *
 * Profile: full only (subset B in core-tools umbrella).
 */

import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { resolveFilePath } from "../../shared/path-utils.js";
import { FIX_RUNNERS } from "./runners.ts";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		const ev = event as { toolName?: string };
		const toolName = ev.toolName ?? "";

		// Only trigger on write or edit
		if (toolName !== "write" && toolName !== "edit") return;

		const input = (event as { input?: Record<string, unknown> }).input ?? {};
		const rawPath = (input as { path?: string }).path ?? "";
		if (!rawPath) return;

		const filePath = resolveFilePath(rawPath);
		if (!existsSync(filePath)) return;

		for (const runner of FIX_RUNNERS) {
			if (!runner.isAvailable(dirname(filePath))) continue;

			const result = runner.fix(filePath);
			if (result.error) {
				console.error(
					`[autofix] ${runner.name} error on ${filePath}: ${result.error}`,
				);
			}
		}
	});
}
