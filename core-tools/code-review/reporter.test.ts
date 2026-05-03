/**
 * Code review reporter — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildReport, saveReport } from "./reporter.ts";
import type { FileComplexity } from "./complexity.ts";
import type { TodoSummary } from "./todo-scanner.ts";
import type { TDIResult } from "./tdi.ts";

const mockTdi: TDIResult = {
	score: 75,
	grade: "B",
	filesAnalyzed: 5,
	filesWithDebt: 1,
	avgMI: 72.5,
	totalCognitive: 45,
	totalTodos: 3,
	byCategory: { maintainability: 75, cognitive: 70, nesting: 80 },
};

const mockComplexities: FileComplexity[] = [
	{
		filePath: "/project/src/bad.ts",
		linesOfCode: 150,
		cognitiveComplexity: 35,
		cyclomaticComplexity: 20,
		maxNestingDepth: 6,
		maintainabilityIndex: 45,
	},
	{
		filePath: "/project/src/good.ts",
		linesOfCode: 20,
		cognitiveComplexity: 2,
		cyclomaticComplexity: 3,
		maxNestingDepth: 2,
		maintainabilityIndex: 85,
	},
];

const mockTodos: TodoSummary = {
	total: 3,
	byType: { TODO: 2, FIXME: 1 },
	byFile: { "/project/src/work.ts": 3 },
	items: [
		{ file: "/project/src/work.ts", line: 5, type: "TODO", text: "implement feature" },
		{ file: "/project/src/work.ts", line: 10, type: "FIXME", text: "fix edge case" },
		{ file: "/project/src/work.ts", line: 15, type: "TODO", text: "add tests" },
	],
};

describe("buildReport", () => {
	it("includes TDI score in output", () => {
		const report = buildReport({
			tdi: mockTdi,
			complexities: mockComplexities,
			todos: mockTodos,
			projectRoot: "/project",
		});
		assert(report.includes("75/100"));
		assert(report.includes("B"));
	});

	it("includes complexity hotspots", () => {
		const report = buildReport({
			tdi: mockTdi,
			complexities: mockComplexities,
			todos: mockTodos,
			projectRoot: "/project",
		});
		assert(report.includes("bad.ts"));
		assert(report.includes("cognitive=35"));
	});

	it("includes TODO inventory", () => {
		const report = buildReport({
			tdi: mockTdi,
			complexities: mockComplexities,
			todos: mockTodos,
			projectRoot: "/project",
		});
		assert(report.includes("TODO"));
		assert(report.includes("FIXME"));
		assert(report.includes("implement feature"));
	});
});

describe("saveReport", () => {
	it("saves report to .pi/reviews/", () => {
		const dir = mkdtempSync(join(tmpdir(), "cr-test-"));
		try {
			const report = buildReport({
				tdi: mockTdi,
				complexities: mockComplexities,
				todos: mockTodos,
				projectRoot: dir,
			});
			const filePath = saveReport(report, dir);
			assert(existsSync(filePath));
			assert(filePath.includes(".pi/reviews/"));
			const content = readFileSync(filePath, "utf-8");
			assert(content.includes("Code Review Report"));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
