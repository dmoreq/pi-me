/**
 * Read-Before-Edit Guard
 *
 * Blocks edits that lack adequate prior reading:
 * 1. Zero-read edit — never read this file in this turn
 * 2. File modified since read — disk content changed (FileTime)
 * 3. Out-of-range edit — edit target not covered by any previous read
 *
 * New file writes (file doesn't exist) are exempt.
 */

import { existsSync } from "node:fs";
import { FileTime } from "./file-time.ts";

// ── Types ────────────────────────────────────────────────────────────────

export interface ReadRecord {
	filePath: string;
	offset: number;
	limit: number;
	timestamp: number;
}

export interface GuardVerdict {
	action: "allow" | "block";
	reason?: string;
}

export interface GuardConfig {
	/** When false, all edits are allowed without checking */
	enabled: boolean;
	/** Lines of context to add around each read when checking coverage */
	contextLines: number;
	/** Glob patterns exempt from guarding */
	exemptPatterns: string[];
}

const DEFAULT_CONFIG: GuardConfig = {
	enabled: true,
	contextLines: 3,
	exemptPatterns: ["*.md", "*.txt", "*.log"],
};

// ── Guard ────────────────────────────────────────────────────────────────

export class ReadGuard {
	private readonly reads = new Map<string, ReadRecord[]>();
	private readonly fileTime = new FileTime();
	private readonly exemptions = new Set<string>();
	private readonly config: GuardConfig;

	constructor(config: Partial<GuardConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	// ── Public API ──────────────────────────────────────────────────────

	recordRead(filePath: string, offset: number, limit: number): void {
		const arr = this.reads.get(filePath) ?? [];
		arr.push({ filePath, offset, limit, timestamp: Date.now() });
		this.reads.set(filePath, arr);
		this.fileTime.read(filePath);
	}

	checkEdit(filePath: string, touchedLines?: [number, number]): GuardVerdict {
		if (!this.config.enabled) return { action: "allow" };

		// New file writes are always allowed
		if (!existsSync(filePath)) return { action: "allow" };

		// Manual exemptions (set via /read-guard-allow)
		if (this.exemptions.has(filePath)) {
			this.exemptions.delete(filePath);
			return { action: "allow" };
		}

		// Pattern exemptions
		if (this.isExemptByPattern(filePath)) return { action: "allow" };

		// 1. Zero-read check
		const fileReads = this.reads.get(filePath);
		if (!fileReads || fileReads.length === 0) {
			return {
				action: "block",
				reason:
					`🔴 Edit without prior read — \`${filePath}\` has not been read in this session.\n` +
					`Read the file first, or run \`/read-guard-allow ${filePath}\` to override.`,
			};
		}

		// 2. FileTime check (staleness)
		if (this.fileTime.hasChanged(filePath)) {
			return {
				action: "block",
				reason:
					`🔴 File modified since read — \`${filePath}\` changed on disk after your last read.\n` +
					`Re-read the file to sync your mental model.`,
			};
		}

		// If no line range specified, allow (can't check range coverage)
		if (!touchedLines) return { action: "allow" };

		// 3. Range coverage check
		if (!this.hasCoverage(filePath, touchedLines)) {
			const lastRead = fileReads[fileReads.length - 1];
			const lastEnd = lastRead.offset + lastRead.limit - 1;
			return {
				action: "block",
				reason:
					`🔴 Edit outside read range — you read \`${filePath}\` lines ${lastRead.offset}–${lastEnd}, ` +
					`but the edit touches lines ${touchedLines[0]}–${touchedLines[1]}.\n` +
					`Read the relevant section first.`,
			};
		}

		return { action: "allow" };
	}

	addExemption(filePath: string): void {
		this.exemptions.add(filePath);
	}

	isNewFile(filePath: string): boolean {
		return !existsSync(filePath);
	}

	reset(): void {
		this.reads.clear();
		this.fileTime.reset();
		this.exemptions.clear();
	}

	getStats(): { totalReads: number; filesRead: number } {
		let totalReads = 0;
		for (const arr of this.reads.values()) {
			totalReads += arr.length;
		}
		return { totalReads, filesRead: this.reads.size };
	}

	// ── Private ─────────────────────────────────────────────────────────

	private isExemptByPattern(filePath: string): boolean {
		return this.config.exemptPatterns.some((pattern) => {
			if (pattern.startsWith("*.")) {
				return filePath.endsWith(pattern.slice(1));
			}
			return filePath === pattern;
		});
	}

	private hasCoverage(
		filePath: string,
		[editStart, editEnd]: [number, number],
	): boolean {
		const fileReads = this.reads.get(filePath) ?? [];

		// Merge all read intervals (with context lines)
		const intervals = fileReads.map((r) => [
			Math.max(1, r.offset - this.config.contextLines),
			r.offset + r.limit - 1 + this.config.contextLines,
		] as [number, number]);

		intervals.sort((a, b) => a[0] - b[0]);

		// Merge overlapping/adjacent intervals
		const merged: Array<[number, number]> = [];
		for (const [s, e] of intervals) {
			if (merged.length > 0 && s <= merged[merged.length - 1][1] + 1) {
				merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
			} else {
				merged.push([s, e]);
			}
		}

		return merged.some(([s, e]) => editStart >= s && editEnd <= e);
	}
}
