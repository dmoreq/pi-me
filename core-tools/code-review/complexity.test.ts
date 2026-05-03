/**
 * Complexity analysis — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeFile } from "./complexity.ts";

describe("analyzeFile", () => {
	it("returns null for non-existent file", () => {
		assert.equal(analyzeFile("/nonexistent/file.ts"), null);
	});

	it("returns metrics for a simple file", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(
				join(dir, "test.ts"),
				"function hello(name: string) {\n  return `Hello ${name}`;\n}\n",
			);
			const result = analyzeFile(join(dir, "test.ts"));
			assert(result !== null);
			assert(result.linesOfCode > 0);
			assert(typeof result.cognitiveComplexity === "number");
			assert(typeof result.cyclomaticComplexity === "number");
			assert(typeof result.maxNestingDepth === "number");
			assert(typeof result.maintainabilityIndex === "number");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects high complexity in nested code", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(
				join(dir, "complex.ts"),
				[
					"function process(items: any[]) {",
					"  for (const item of items) {",
					"    if (item.active) {",
					"      if (item.value > 10) {",
					"        if (item.type === 'special') {",
					"          return item;",
					"        }",
					"      }",
					"    }",
					"  }",
					"}",
				].join("\n"),
			);
			const result = analyzeFile(join(dir, "complex.ts"));
			assert(result !== null);
			assert(result.cyclomaticComplexity >= 4); // 1 base + 3 if/for
			assert(result.maxNestingDepth >= 4);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns 0 complexity for empty file", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(join(dir, "empty.ts"), "");
			const result = analyzeFile(join(dir, "empty.ts"));
			assert(result !== null);
			assert.equal(result.cognitiveComplexity, 0);
			assert.equal(result.cyclomaticComplexity, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
