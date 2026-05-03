/**
 * Synchronous tool availability detection.
 *
 * Checks if a command is available on the system PATH.
 * Uses fs.accessSync for cross-platform compatibility (unlike shelling out to `which`).
 */

import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const cache = new Map<string, boolean>();

/**
 * Check if a command is available on PATH.
 * Results are cached across calls.
 */
export function hasCommand(command: string): boolean {
	const cached = cache.get(command);
	if (cached !== undefined) return cached;

	const pathValue = process.env.PATH ?? "";
	const pathDirs = pathValue
		.split(delimiter)
		.map((e) => e.trim())
		.filter((e) => e.length > 0);

	for (const dir of pathDirs) {
		try {
			accessSync(join(dir, command), constants.X_OK);
			cache.set(command, true);
			return true;
		} catch {
			// Not found in this directory — keep searching
		}
	}

	cache.set(command, false);
	return false;
}

/**
 * Clear the command availability cache.
 * Useful in tests.
 */
export function clearCommandCache(): void {
	cache.clear();
}
