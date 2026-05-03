/**
 * Technical Debt Index (TDI) — Composite code health score.
 *
 * Combines multiple metrics into a 0–100 score:
 *   - Maintainability Index (weighted highest)
 *   - Cognitive complexity burden
 *   - TODO/FIXME density
 *   - Nesting depth outliers
 */

import type { FileComplexity } from "./complexity.ts";
import type { TodoSummary } from "./todo-scanner.ts";

export interface TDIResult {
	score: number;
	grade: string;
	filesAnalyzed: number;
	filesWithDebt: number;
	avgMI: number;
	totalCognitive: number;
	totalTodos: number;
	byCategory: {
		maintainability: number;
		cognitive: number;
		nesting: number;
	};
}

/**
 * Compute the Technical Debt Index from complexity data and TODO inventory.
 *
 * Score interpretation:
 *   0–30  🔴 High debt — needs refactoring
 *   31–60 🟡 Moderate debt — monitor
 *   61–80 🟢 Healthy — minor improvements
 *   81–100 ✅ Excellent
 */
export function computeTDI(
	complexities: FileComplexity[],
	todos: TodoSummary,
): TDIResult {
	if (complexities.length === 0) {
		return {
			score: 100,
			grade: "A",
			filesAnalyzed: 0,
			filesWithDebt: 0,
			avgMI: 100,
			totalCognitive: 0,
			totalTodos: 0,
			byCategory: { maintainability: 0, cognitive: 0, nesting: 0 },
		};
	}

	const avgMI =
		complexities.reduce((sum, c) => sum + c.maintainabilityIndex, 0) /
		complexities.length;
	const totalCognitive = complexities.reduce(
		(sum, c) => sum + c.cognitiveComplexity,
		0,
	);
	const filesWithDebt = complexities.filter(
		(c) => c.maintainabilityIndex < 60 || c.cognitiveComplexity > 20,
	).length;
	const maxNesting = Math.max(
		...complexities.map((c) => c.maxNestingDepth),
	);

	// Category scores (0 = worst, 100 = best)
	const maintainabilityScore = avgMI;
	const cognitiveScore = Math.max(
		0,
		100 - Math.min(100, totalCognitive / Math.max(1, complexities.length) * 5),
	);
	const nestingScore = Math.max(0, 100 - maxNesting * 8);

	// Composite score
	const score = Math.round(
		maintainabilityScore * 0.5 + cognitiveScore * 0.3 + nestingScore * 0.2,
	);

	let grade: string;
	if (score >= 81) grade = "A";
	else if (score >= 61) grade = "B";
	else if (score >= 41) grade = "C";
	else if (score >= 21) grade = "D";
	else grade = "F";

	return {
		score: Math.max(0, Math.min(100, score)),
		grade,
		filesAnalyzed: complexities.length,
		filesWithDebt,
		avgMI: Math.round(avgMI * 100) / 100,
		totalCognitive,
		totalTodos: todos.total,
		byCategory: {
			maintainability: Math.round(maintainabilityScore),
			cognitive: Math.round(cognitiveScore),
			nesting: Math.round(nestingScore),
		},
	};
}
