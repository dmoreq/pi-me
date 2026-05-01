/**
 * pi-me: protected-paths — Sensitive path write protection.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import { type ProtectedGlob, DEFAULT_PROTECTED_PATHS, matchesGlob } from "./path-guard";

export type { ProtectedGlob } from "./path-guard";
export { DEFAULT_PROTECTED_PATHS, matchesGlob } from "./path-guard";

export interface ProtectedPathsOptions {
	paths?: ProtectedGlob[];
}

function extractFilePath(toolName: string, input: Record<string, unknown>): string | undefined {
	switch (toolName) {
		case "write":
			return typeof input.path === "string" ? input.path : undefined;
		case "edit":
			return typeof input.path === "string" ? input.path : undefined;
		case "bash": {
			const cmd = typeof input.command === "string" ? input.command : undefined;
			if (!cmd) return undefined;
			return extractBashWritePath(cmd);
		}
		default:
			return undefined;
	}
}

function extractBashWritePath(command: string): string | undefined {
	const patterns = [
		/[12]?>>?\s*(\S+)/g,
		/(?:cat|echo|printf)\s+.*?>(?:>\s*)?(\S+)/,
		/\btee\s+(?:-[a-zA-Z]*\s+)*(\S+)/g,
		/\bcp\s+(?:-[a-zA-Z]*\s+)*\S+\s+(\S+)/,
		/\bmv\s+(?:-[a-zA-Z]*\s+)*\S+\s+(\S+)/,
	];

	for (const re of patterns) {
		re.lastIndex = 0;
		const match = re.exec(command);
		if (match) {
			const target = match[1];
			if (target && !target.startsWith("-") && !target.startsWith("|") && target !== "/dev/null") {
				return target;
			}
		}
	}
	return undefined;
}

export function createProtectedPaths(options: ProtectedPathsOptions = {}): (pi: ExtensionAPI) => void {
	const protectedPaths = options.paths ?? DEFAULT_PROTECTED_PATHS;

	return (pi: ExtensionAPI) => {
		pi.on("tool_call", async (event, ctx) => {
			if (event.toolName !== "write" && event.toolName !== "edit" && event.toolName !== "bash") {
				return;
			}

			const input = event.input as Record<string, unknown>;
			const filePath = extractFilePath(event.toolName, input);
			if (!filePath) return;

			const relativePath = path.isAbsolute(filePath)
				? path.relative(ctx.cwd, filePath)
				: filePath;

			if (relativePath.startsWith("..")) return;

			const matches = protectedPaths.filter((p) => matchesGlob(relativePath, p.glob));
			if (matches.length === 0) return;

			if (!ctx.hasUI) {
				const paths = matches.map((m) => `  ${m.glob}: ${m.reason}`).join("\n");
				return {
					block: true,
					reason: `Write to protected path(s) blocked:\n${paths}`,
				};
			}

			const detail = matches.map((m) => `  ${m.glob} — ${m.reason}`).join("\n");
			const choice = await ctx.ui.select(
				`Protected path write:\n\n  → ${filePath}\n\n${detail}\n\nAllow this write?`,
				["Block", "Allow"],
			);

			if (choice !== "Allow") {
				return { block: true, reason: "Protected path write blocked by user" };
			}
		});
	};
}

export default createProtectedPaths();
