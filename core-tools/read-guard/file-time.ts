/**
 * FileTime — tracks file modification times to detect stale reads.
 */

import { statSync } from "node:fs";

export interface FileTimeEntry {
	mtimeMs: number;
	readAt: number;
}

export class FileTime {
	private readonly timestamps = new Map<string, FileTimeEntry>();

	read(filePath: string): void {
		try {
			const stat = statSync(filePath);
			this.timestamps.set(filePath, {
				mtimeMs: stat.mtimeMs,
				readAt: Date.now(),
			});
		} catch {
			// File doesn't exist yet (new file) — clear any stale record
			this.timestamps.delete(filePath);
		}
	}

	hasChanged(filePath: string): boolean {
		const entry = this.timestamps.get(filePath);
		if (!entry) return false; // never read — covered by zero-read check

		try {
			const stat = statSync(filePath);
			return stat.mtimeMs > entry.mtimeMs;
		} catch {
			// File was deleted since last read
			return true;
		}
	}

	reset(filePath?: string): void {
		if (filePath) {
			this.timestamps.delete(filePath);
		} else {
			this.timestamps.clear();
		}
	}
}
