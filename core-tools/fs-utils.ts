/**
 * Shared file system utilities
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Directory filter configuration
 */
export interface DirectoryScannerConfig {
	/** Extensions to match (with dots, e.g., [".ts", ".js"]) */
	extensions?: Set<string>;
	/** Callback for each file */
	onFile?: (filePath: string) => void;
	/** Callback for entering directory */
	onDir?: (dirPath: string) => void;
	/** Directories to skip (by name) */
	skipDirs?: Set<string>;
	/** Whether to continue recursion for a directory */
	shouldRecurse?: (dirPath: string, dirName: string) => boolean;
}

/**
 * Default directories to skip during traversal
 */
export const DEFAULT_SKIP_DIRS = new Set([
	".git",
	".hg",
	".svn",
	"node_modules",
	"dist",
	"build",
	"out",
	".next",
	".venv",
	"__pycache__",
	"target",
]);

/**
 * Recursively traverse a directory tree
 */
export function scanDirectory(
	dir: string,
	config: DirectoryScannerConfig = {},
): void {
	const {
		extensions,
		onFile,
		onDir,
		skipDirs = DEFAULT_SKIP_DIRS,
		shouldRecurse = (_, dirName) => !dirName.startsWith(".") && !skipDirs.has(dirName),
	} = config;

	function scan(currentDir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(currentDir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = join(currentDir, entry.name);

			if (entry.isDirectory()) {
				if (!shouldRecurse(fullPath, entry.name)) {
					continue;
				}
				onDir?.(fullPath);
				scan(fullPath);
			} else if (!extensions || extensions.has(getExtension(entry.name))) {
				onFile?.(fullPath);
			}
		}
	}

	scan(dir);
}

/**
 * Get file extension (e.g., ".ts" for "file.ts")
 */
export function getExtension(fileName: string): string {
	const lastDot = fileName.lastIndexOf(".");
	return lastDot > 0 ? fileName.slice(lastDot) : "";
}
