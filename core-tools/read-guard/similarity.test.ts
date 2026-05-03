/**
 * Structural similarity — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	buildExportIndex,
	checkExportRedefinition,
	checkStructuralSimilarity,
	jaccardSimilarity,
} from "./similarity.ts";

describe("jaccardSimilarity", () => {
	it("returns 1 for identical strings", () => {
		assert.equal(jaccardSimilarity("hello world", "hello world"), 1);
	});

	it("returns 0 for completely different strings", () => {
		assert.equal(jaccardSimilarity("abc def", "ghi jkl"), 0);
	});

	it("returns partial for overlapping strings", () => {
		const sim = jaccardSimilarity("hello world foo", "hello world bar");
		assert(sim > 0 && sim < 1);
	});

	it("handles empty strings", () => {
		assert.equal(jaccardSimilarity("", ""), 0);
	});
});

describe("buildExportIndex", () => {
	it("finds exported functions in source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			writeFileSync(join(dir, "a.ts"), "export function hello() {}\nexport const x = 1;");
			writeFileSync(join(dir, "b.ts"), "export function goodbye() {}\nexport type T = string;");

			const index = buildExportIndex(dir);
			assert.equal(index.get("hello"), join(dir, "a.ts"));
			assert.equal(index.get("goodbye"), join(dir, "b.ts"));
			assert.equal(index.get("x"), join(dir, "a.ts"));
			assert.equal(index.get("T"), join(dir, "b.ts"));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("skips node_modules", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			writeFileSync(join(dir, "a.ts"), "export function found() {}");
			mkdirSync(join(dir, "node_modules"), { recursive: true });
			writeFileSync(join(dir, "node_modules", "hidden.ts"), "export function lost() {}");

			const index = buildExportIndex(dir);
			assert(index.has("found"));
			assert(!index.has("lost"));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("checkExportRedefinition", () => {
	it("returns null when no conflicts", () => {
		const index = new Map([["hello", "/project/a.ts"]]);
		const result = checkExportRedefinition(
			"export function goodbye() {}",
			"/project/b.ts",
			index,
			"/project",
		);
		assert.equal(result, null);
	});

	it("returns warning when export name conflicts", () => {
		const index = new Map([["hello", "/project/a.ts"]]);
		const result = checkExportRedefinition(
			"export function hello() {}",
			"/project/b.ts",
			index,
			"/project",
		);
		assert(result?.includes("hello"));
		assert(result?.includes("a.ts"));
		assert(result?.includes("Import instead"));
	});

	it("ignores self-redefinition (same file)", () => {
		const index = new Map([["hello", "/project/a.ts"]]);
		const result = checkExportRedefinition(
			"export function hello() {}",
			"/project/a.ts",
			index,
			"/project",
		);
		assert.equal(result, null);
	});
});

describe("checkStructuralSimilarity", () => {
	it("returns null for new content without functions", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			const result = checkStructuralSimilarity("const x = 42;", join(dir, "new.ts"), dir);
			assert.equal(result, null);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns null when no similar functions exist", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			writeFileSync(join(dir, "existing.ts"), "function existing() { return 42; }");
			const result = checkStructuralSimilarity(
				"function newFunc() { console.log('different'); }",
				join(dir, "new.ts"),
				dir,
			);
			assert.equal(result, null);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns warning when identical function exists in another file", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			const body = "return items.filter(i => i.active).map(i => i.name).sort();";
			writeFileSync(join(dir, "existing.ts"), `function existing() { ${body} }`);
			const result = checkStructuralSimilarity(
				`function newFunc() { ${body} }`,
				join(dir, "new.ts"),
				dir,
			);
			assert(result?.includes("similar"));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns null when similarity is below threshold", () => {
		const dir = mkdtempSync(join(tmpdir(), "sim-test-"));
		try {
			writeFileSync(join(dir, "existing.ts"), "function existing() { return a + b; }");
			const result = checkStructuralSimilarity(
				"function newFunc() { console.log('completely different'); }",
				join(dir, "new.ts"),
				dir,
			);
			assert.equal(result, null);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
