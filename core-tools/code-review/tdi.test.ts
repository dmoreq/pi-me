/**
 * TDI calculator — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTDI, type TDIResult } from "./tdi.ts";
import type { FileComplexity } from "./complexity.ts";
import type { TodoSummary } from "./todo-scanner.ts";

const emptyTodos: TodoSummary = {
	total: 0,
	byType: {},
	byFile: {},
	items: [],
};

describe("computeTDI", () => {
	it("returns perfect score for empty input", () => {
		const result = computeTDI([], emptyTodos);
		assert.equal(result.score, 100);
		assert.equal(result.grade, "A");
	});

	it("returns high score for clean code", () => {
		const complexities: FileComplexity[] = [
			{
				filePath: "/a.ts",
				linesOfCode: 10,
				cognitiveComplexity: 1,
				cyclomaticComplexity: 1,
				maxNestingDepth: 1,
				maintainabilityIndex: 90,
			},
		];
		const result = computeTDI(complexities, emptyTodos);
		assert(result.score >= 70);
	});

	it("returns low score for complex code", () => {
		const complexities: FileComplexity[] = [
			{
				filePath: "/bad.ts",
				linesOfCode: 200,
				cognitiveComplexity: 80,
				cyclomaticComplexity: 40,
				maxNestingDepth: 8,
				maintainabilityIndex: 30,
			},
		];
		const result = computeTDI(complexities, emptyTodos);
		assert(result.score <= 50);
	});

	it("assigns correct grades", () => {
		const makeComplexity = (mi: number, cog: number, nest: number): FileComplexity => ({
			filePath: "/f.ts",
			linesOfCode: 50,
			cognitiveComplexity: cog,
			cyclomaticComplexity: 5,
			maxNestingDepth: nest,
			maintainabilityIndex: mi,
		});

		const grades: Array<{ mi: number; cog: number; nest: number; expectedGrade: string }> = [
			{ mi: 90, cog: 1, nest: 1, expectedGrade: "A" },
			{ mi: 70, cog: 5, nest: 3, expectedGrade: "B" },
			{ mi: 50, cog: 15, nest: 5, expectedGrade: "C" },
			{ mi: 30, cog: 30, nest: 7, expectedGrade: "D" },
		];

		for (const g of grades) {
			const result = computeTDI([makeComplexity(g.mi, g.cog, g.nest)], emptyTodos);
			assert.equal(result.grade, g.expectedGrade);
		}
	});

	it("includes TODO count in output", () => {
		const todos: TodoSummary = {
			total: 15,
			byType: { TODO: 10, FIXME: 5 },
			byFile: { "/a.ts": 15 },
			items: [],
		};
		const complexities: FileComplexity[] = [
			{
				filePath: "/a.ts",
				linesOfCode: 10,
				cognitiveComplexity: 1,
				cyclomaticComplexity: 1,
				maxNestingDepth: 1,
				maintainabilityIndex: 90,
			},
		];
		const result = computeTDI(complexities, todos);
		assert.equal(result.totalTodos, 15);
	});
});
