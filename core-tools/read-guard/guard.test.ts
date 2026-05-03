/**
 * Read-Before-Edit Guard — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ReadGuard } from "./guard.ts";

function createTempFile(prefix = "rg-test-"): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	const filePath = join(dir, "test.ts");
	writeFileSync(filePath, "line1\nline2\nline3\nline4\nline5\n");
	return filePath;
}

function removeTempFile(fp: string): void {
	try {
		unlinkSync(fp);
		const dir = join(fp, "..");
		try {
			rmdirSync(dir);
		} catch {
			// ignore
		}
	} catch {
		// ignore
	}
}

import { rmdirSync } from "node:fs";

describe("ReadGuard", () => {
	describe("checkEdit — zero-read", () => {
		it("blocks edit with no prior read", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "block");
				assert(verdict.reason?.includes("haven't read"));
			} finally {
				removeTempFile(fp);
			}
		});

		it("allows edit after read", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 10);
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});
	});

	describe("checkEdit — staleness", () => {
		it("blocks edit after file changed on disk", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 10);

				// Modify the file
				writeFileSync(fp, "modified\ncontent\n");

				const verdict = guard.checkEdit(fp, [1, 2]);
				assert.equal(verdict.action, "block");
				assert(verdict.reason?.includes("updated since"));
			} finally {
				removeTempFile(fp);
			}
		});
	});

	describe("checkEdit — range coverage", () => {
		it("blocks edit targeting unread lines", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 3); // Read lines 1-3

				const verdict = guard.checkEdit(fp, [10, 15]); // Edit lines 10-15
				assert.equal(verdict.action, "block");
				assert(verdict.reason?.includes("only peeked at lines"));
			} finally {
				removeTempFile(fp);
			}
		});

		it("allows edit within read range with context lines", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 5); // Read lines 1-5

				// Edit lines 1-5 should be covered (with 3 context lines)
				const verdict = guard.checkEdit(fp, [1, 5]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});

		it("allows edit within merged adjacent read intervals", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 47);  // covers 1-47 (with context: 1-50)
				guard.recordRead(fp, 54, 50); // covers 54-103 (with context: 51-106)
				// Intervals [1,50] and [51,106] merge into [1,106]

				// Edit within merged range
				const verdict = guard.checkEdit(fp, [48, 52]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});

		it("allows edit within overlapping read intervals", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 60);  // covers 1-60
				guard.recordRead(fp, 40, 60); // covers 40-99

				// Edit spanning both reads
				const verdict = guard.checkEdit(fp, [50, 70]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});
	});

	describe("checkEdit — exemptions", () => {
		it("allows edit after manual exemption", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.addExemption(fp);
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});

		it("exemption is one-time use", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.addExemption(fp);
				guard.checkEdit(fp, [1, 3]); // First: uses exemption

				const verdict = guard.checkEdit(fp, [1, 3]); // Second: no exemption
				assert.equal(verdict.action, "block");
			} finally {
				removeTempFile(fp);
			}
		});

		it("allows new file without prior read", () => {
			const guard = new ReadGuard();
			const fp = join(join(tmpdir(), "rg-test-new"), "new.ts");
			try {
				// File doesn't exist
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "allow");
			} finally {
				try {
					unlinkSync(fp);
				} catch {
					// ignore
				}
			}
		});
	});

	describe("checkEdit — disabled guard", () => {
		it("allows everything when disabled", () => {
			const guard = new ReadGuard({ enabled: false });
			const fp = createTempFile();
			try {
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "allow");
			} finally {
				removeTempFile(fp);
			}
		});
	});

	describe("recordRead", () => {
		it("tracks reads by file path", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 10);
				guard.recordRead(fp, 20, 5);

				const stats = guard.getStats();
				assert.equal(stats.totalReads, 2);
				assert.equal(stats.filesRead, 1);
			} finally {
				removeTempFile(fp);
			}
		});
	});

	describe("reset", () => {
		it("clears all state", () => {
			const guard = new ReadGuard();
			const fp = createTempFile();
			try {
				guard.recordRead(fp, 1, 10);
				guard.addExemption(fp);
				guard.reset();

				const stats = guard.getStats();
				assert.equal(stats.totalReads, 0);
				assert.equal(stats.filesRead, 0);

				// Exemption also cleared — should block
				const verdict = guard.checkEdit(fp, [1, 3]);
				assert.equal(verdict.action, "block");
			} finally {
				removeTempFile(fp);
			}
		});
	});
});
