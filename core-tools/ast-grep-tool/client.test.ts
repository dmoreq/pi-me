/**
 * AST-grep client — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { astGrepSearch, astGrepReplace, isAstGrepAvailable } from "./client.ts";

const available = isAstGrepAvailable();

function createTempProject(): string {
	const dir = mkdtempSync(join(tmpdir(), "ag-test-"));
	writeFileSync(
		join(dir, "test.ts"),
		[
			"function hello() {",
			'  console.log("hello world");',
			"}",
			"",
			"function goodbye() {",
			'  console.log("goodbye");',
			"}",
		].join("\n"),
	);
	return dir;
}

describe("isAstGrepAvailable", () => {
	it("returns boolean", () => {
		assert.equal(typeof available, "boolean");
	});
});

describe("astGrepSearch", () => {
	it("finds function declarations", { skip: !available }, () => {
		const dir = createTempProject();
		try {
			const result = astGrepSearch(
				"function $NAME($$$ARGS) { $$$BODY }",
				"typescript",
				[dir],
			);
			assert.equal(result.error, undefined);
			assert(result.matches.length >= 2);
			assert(result.matches.some((m) => m.text.includes("hello")));
			assert(result.matches.some((m) => m.text.includes("goodbye")));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("finds console.log calls", { skip: !available }, () => {
		const dir = createTempProject();
		try {
			const result = astGrepSearch("console.log($$$ARGS)", "typescript", [dir]);
			assert.equal(result.error, undefined);
			assert(result.matches.length >= 2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns empty for no matches", { skip: !available }, () => {
		const dir = createTempProject();
		try {
			const result = astGrepSearch(
				"class $NAME { $$$BODY }",
				"typescript",
				[dir],
			);
			assert.equal(result.matches.length, 0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles non-existent path gracefully", () => {
		const result = astGrepSearch("console.log($$$ARGS)", "typescript", [
			"/nonexistent/path",
		]);
		// Should not throw; should return empty or error
		assert.ok(result.matches.length === 0 || result.error);
	});
});

describe("astGrepReplace", () => {
	it("replaces function names", { skip: !available }, () => {
		const dir = createTempProject();
		try {
			const result = astGrepReplace(
				"function hello($$$ARGS) { $$$BODY }",
				"function bonjour($$$ARGS) { $$$BODY }",
				"typescript",
				[dir],
			);
			assert.equal(result.error, undefined);
			assert.equal(result.filesChanged, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles no matches gracefully", () => {
		const result = astGrepReplace(
			"class $NAME {}",
			"struct $NAME {}",
			"typescript",
			["/nonexistent"],
		);
		assert.equal(result.filesChanged, 0);
	});
});
