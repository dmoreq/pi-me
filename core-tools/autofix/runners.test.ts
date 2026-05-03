/**
 * Auto-fix runners — Tests
 *
 * Tests runner detection (isAvailable) and that fix() handles
 * missing files/tools gracefully without crashing.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FIX_RUNNERS } from "./runners.ts";

describe("FIX_RUNNERS", () => {
	it("exports an array of runners", () => {
		assert(Array.isArray(FIX_RUNNERS));
		assert(FIX_RUNNERS.length > 0);
	});

	it("each runner has name, isAvailable, fix", () => {
		for (const runner of FIX_RUNNERS) {
			assert(typeof runner.name === "string");
			assert(runner.name.length > 0);
			assert(typeof runner.isAvailable === "function");
			assert(typeof runner.fix === "function");
		}
	});

	it("runner names are unique", () => {
		const names = FIX_RUNNERS.map((r) => r.name);
		assert.equal(new Set(names).size, names.length);
	});
});

describe("biome runner", () => {
	const runner = FIX_RUNNERS.find((r) => r.name === "biome")!;

	it("isAvailable returns false in dir without biome config", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			assert.equal(runner.isAvailable(dir), false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("isAvailable returns true when biome.json exists", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			writeFileSync(join(dir, "biome.json"), "{}");
			assert.equal(runner.isAvailable(dir), true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("fix handles non-existent file gracefully", () => {
		const result = runner.fix("/nonexistent/path/file.ts");
		assert(typeof result.changed === "boolean");
		// Should not throw
	});
});

describe("eslint runner", () => {
	const runner = FIX_RUNNERS.find((r) => r.name === "eslint")!;

	it("isAvailable returns false in dir without eslint config", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			assert.equal(runner.isAvailable(dir), false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("isAvailable returns true when .eslintrc exists", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			writeFileSync(join(dir, ".eslintrc"), "{}");
			assert.equal(runner.isAvailable(dir), true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("ruff runner", () => {
	const runner = FIX_RUNNERS.find((r) => r.name === "ruff")!;

	it("isAvailable returns false in dir without ruff config", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			assert.equal(runner.isAvailable(dir), false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("isAvailable returns true when ruff.toml exists", () => {
		const dir = mkdtempSync(join(tmpdir(), "af-test-"));
		try {
			writeFileSync(join(dir, "ruff.toml"), "");
			assert.equal(runner.isAvailable(dir), true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
