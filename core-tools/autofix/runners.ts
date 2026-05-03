/**
 * Auto-fix runner definitions.
 *
 * Each runner knows how to detect its tool configuration and
 * run the appropriate `--fix` command on a file.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────

export interface FixResult {
	changed: boolean;
	error?: string;
}

export interface FixRunner {
	readonly name: string;
	isAvailable(dir: string): boolean;
	fix(filePath: string): FixResult;
}

// ── Config file discovery ────────────────────────────────────────────────

function findConfig(dir: string, patterns: string[]): string | null {
	let current = resolve(dir);
	const root = resolve("/");
	while (current !== root) {
		for (const pattern of patterns) {
			if (existsSync(resolve(current, pattern))) {
				return resolve(current, pattern);
			}
		}
		const parent = resolve(current, "..");
		if (parent === current) break;
		current = parent;
	}
	return null;
}

// ── Runners ──────────────────────────────────────────────────────────────

const biomeFix: FixRunner = {
	name: "biome",
	isAvailable(dir: string) {
		return (
			findConfig(dir, ["biome.json", "biome.jsonc"]) !== null
		);
	},
	fix(filePath: string) {
		try {
			const result = spawnSync(
				"biome",
				["check", "--write", "--unsafe", filePath],
				{ encoding: "utf-8", timeout: 15_000 },
			);
			const changed = (result.stdout ?? "").includes("Fixed");
			const error =
				result.status !== 0 ? (result.stderr || undefined) : undefined;
			return { changed, error };
		} catch (err) {
			return { changed: false, error: String(err) };
		}
	},
};

const eslintFix: FixRunner = {
	name: "eslint",
	isAvailable(dir: string) {
		return (
			findConfig(dir, [
				".eslintrc",
				".eslintrc.json",
				".eslintrc.js",
				".eslintrc.yaml",
				"eslint.config.js",
			]) !== null
		);
	},
	fix(filePath: string) {
		try {
			const result = spawnSync(
				"npx",
				["eslint", "--fix", filePath],
				{ encoding: "utf-8", timeout: 15_000 },
			);
			const error =
				result.status !== 0 ? (result.stderr || undefined) : undefined;
			return { changed: true, error };
		} catch (err) {
			return { changed: false, error: String(err) };
		}
	},
};

const ruffFix: FixRunner = {
	name: "ruff",
	isAvailable(dir: string) {
		return (
			findConfig(dir, ["pyproject.toml", "ruff.toml", ".ruff.toml"]) !== null
		);
	},
	fix(filePath: string) {
		try {
			const result = spawnSync(
				"ruff",
				["check", "--fix", filePath],
				{ encoding: "utf-8", timeout: 15_000 },
			);
			const changed = (result.stdout ?? "").includes("fixed");
			const error =
				result.status !== 0 ? (result.stderr || undefined) : undefined;
			return { changed, error };
		} catch (err) {
			return { changed: false, error: String(err) };
		}
	},
};

export const FIX_RUNNERS: readonly FixRunner[] = [biomeFix, eslintFix, ruffFix];
