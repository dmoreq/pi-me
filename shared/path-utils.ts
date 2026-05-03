/**
 * Shared path resolution utilities.
 *
 * Provides consistent file path resolution across extensions that
 * handle tool_call events (read-guard, autofix, etc.).
 */

import { resolve, isAbsolute } from "node:path";

/**
 * Resolve a possibly-relative file path against a working directory.
 * If the path is already absolute, returns it as-is.
 */
export function resolveFilePath(rawPath: string, cwd?: string): string {
	return isAbsolute(rawPath) ? rawPath : resolve(cwd ?? process.cwd(), rawPath);
}
