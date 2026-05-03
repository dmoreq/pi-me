/**
 * TODO scanner — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanTodos } from "./todo-scanner.ts";

describe("scanTodos", () => {
	it("returns empty summary when no TODOs exist", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(join(dir, "clean.ts"), "const x = 42;\nconsole.log(x);\n");
			const result = scanTodos(dir);
			assert.equal(result.total, 0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects TODO comments", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(
				join(dir, "work.ts"),
				"// TODO: implement this later\nconst x = 42;\n",
			);
			const result = scanTodos(dir);
			assert.equal(result.total, 1);
			assert.equal(result.items[0].type, "TODO");
			assert(result.items[0].text.includes("implement this later"));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects FIXME and HACK", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(
				join(dir, "messy.ts"),
				"// FIXME: this is broken\n// HACK: workaround for bug\nconst x = 1;\n",
			);
			const result = scanTodos(dir);
			assert.equal(result.total, 2);
			assert(result.byType["FIXME"] === 1);
			assert(result.byType["HACK"] === 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("byType and byFile are populated correctly", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			writeFileSync(join(dir, "a.ts"), "// TODO: do thing A\n");
			writeFileSync(join(dir, "b.ts"), "// TODO: do thing B\n// FIXME: fix B\n");
			const result = scanTodos(dir);
			assert.equal(result.total, 3);
			assert.equal(result.byType["TODO"], 2);
			assert.equal(result.byType["FIXME"], 1);
			assert(Object.keys(result.byFile).length === 2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
