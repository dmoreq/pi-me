/**
 * Shared test utilities
 */

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Create a temporary directory for testing
 */
export function createTempDir(prefix: string = "test-"): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 */
export function cleanupTempDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

/**
 * Create and automatically clean up a temporary directory within a test
 */
export function withTempDir<T>(
	prefix: string,
	fn: (dir: string) => T,
): T {
	const dir = createTempDir(prefix);
	try {
		return fn(dir);
	} finally {
		cleanupTempDir(dir);
	}
}

/**
 * Create and automatically clean up a temporary directory within an async test
 */
export async function withTempDirAsync<T>(
	prefix: string,
	fn: (dir: string) => Promise<T>,
): Promise<T> {
	const dir = createTempDir(prefix);
	try {
		return await fn(dir);
	} finally {
		cleanupTempDir(dir);
	}
}
