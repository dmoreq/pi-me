/**
 * Minimal ast-grep CLI wrapper.
 *
 * Spawns `sg` (ast-grep CLI) with arguments as array to avoid shell interpretation
 * of pattern metavariables (\$NAME, \$\$\$ARGS).
 */

import { spawnSync } from "node:child_process";

export interface AstGrepMatch {
	file: string;
	line: number;
	column: number;
	text: string;
}

export interface AstGrepResult {
	matches: AstGrepMatch[];
	error?: string;
}

function runSg(args: string[]): { stdout: string; status: number | null } {
	const result = spawnSync("sg", args, {
		encoding: "utf-8",
		timeout: 30_000,
		maxBuffer: 10 * 1024 * 1024,
	});
	return { stdout: result.stdout ?? "", status: result.status };
}

/**
 * Search for AST patterns using ast-grep CLI.
 */
export function astGrepSearch(
	pattern: string,
	lang: string,
	paths: string[],
): AstGrepResult {
	const args = ["-p", pattern, "-l", lang, "--json", ...paths];
	try {
		const { stdout, status } = runSg(args);
		if (status !== 0 && status !== null && !stdout) {
			return { matches: [] };
		}
		return { matches: parseMatches(stdout) };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { matches: [], error: `ast-grep search failed: ${msg}` };
	}
}

/**
 * Replace AST patterns using ast-grep CLI (rewrite mode).
 * Returns number of files modified.
 */
export function astGrepReplace(
	pattern: string,
	rewrite: string,
	lang: string,
	paths: string[],
): { filesChanged: number; error?: string } {
	// Count matches first (dry-run mode)
	const countArgs = ["-p", pattern, "-l", lang, "--json", ...paths];
	try {
		const { stdout } = runSg(countArgs);
		const matches = parseMatches(stdout);
		if (matches.length === 0) {
			return { filesChanged: 0 };
		}

		// Apply rewrite via stdin-stdout pipe for each file
		// Use -U to update files in-place
		const applyArgs = [
			"-p", pattern,
			"-l", lang,
			"-r", rewrite,
			"-U",
			...paths,
		];
		const applyResult = spawnSync("sg", applyArgs, {
			encoding: "utf-8",
			timeout: 30_000,
		});
		if (applyResult.status !== 0 && applyResult.status !== null) {
			return { filesChanged: 0, error: applyResult.stderr ? `ast-grep rewrite failed: ${applyResult.stderr}` : undefined };
		}
		const changedFiles = new Set(matches.map((m) => m.file));
		return { filesChanged: changedFiles.size };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { filesChanged: 0, error: `ast-grep replace failed: ${msg}` };
	}
}

function parseMatches(stdout: string): AstGrepMatch[] {
	try {
		const parsed = JSON.parse(stdout);
		if (Array.isArray(parsed)) {
			// sg --json outputs an array of match objects
			return parsed.map((item: Record<string, unknown>) => ({
				file: String(item.file ?? item.path ?? ""),
				line: Number(item.range?.start?.line ?? 0) + 1, // sg uses 0-based lines
				column: Number(item.range?.start?.column ?? 0) + 1,
				text: String(item.lines ?? item.text ?? ""),
			}));
		}
		if (parsed.matches && Array.isArray(parsed.matches)) {
			return parsed.matches.map((m: Record<string, unknown>) => ({
				file: String(m.file ?? m.path ?? ""),
				line: Number(m.range?.start?.line ?? m.line ?? 0) + 1,
				column: Number(m.range?.start?.column ?? m.col ?? 0) + 1,
				text: String(m.lines ?? m.text ?? m.content ?? ""),
			}));
		}
	} catch {
		// Not JSON — might be text output
	}
	return [];
}

/**
 * Check if ast-grep CLI is available.
 */
export function isAstGrepAvailable(): boolean {
	try {
		const { status } = spawnSync("sg", ["--version"], {
			encoding: "utf-8",
			timeout: 5_000,
		});
		return status === 0;
	} catch {
		return false;
	}
}
