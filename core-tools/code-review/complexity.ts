/**
 * Code complexity analysis.
 *
 * Analyzes file complexity metrics:
 * - Cognitive complexity (how hard is the code to follow?)
 * - Cyclomatic complexity (number of independent paths)
 * - Nesting depth (maximum indentation level)
 * - Lines of code
 * - Maintainability Index (MI)
 */

import { readFileSync, statSync } from "node:fs";

// ── Types ────────────────────────────────────────────────────────────────

export interface FileComplexity {
	filePath: string;
	linesOfCode: number;
	cognitiveComplexity: number;
	cyclomaticComplexity: number;
	maxNestingDepth: number;
	maintainabilityIndex: number;
}

// ── Complexity analysis ──────────────────────────────────────────────────

const COGNITIVE_BOOST_KEYWORDS = /\b(if|else\s+if|for|while|catch|case\s+\w+:)\s/g;
const CYCLOMATIC_KEYWORDS = /\b(if|else\s+if|for|while|catch|case\s+\w+:)\s/g;
const NESTING_OPEN = /{/g;
const NESTING_CLOSE = /}/g;

/**
 * Compute cognitive complexity score for a file.
 * Counts control flow keywords, with nesting bonuses.
 */
function computeCognitiveComplexity(content: string): number {
	const lines = content.split("\n");
	let score = 0;
	let nesting = 0;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

		// Track nesting depth
		const opens = (trimmed.match(NESTING_OPEN) ?? []).length;
		const closes = (trimmed.match(NESTING_CLOSE) ?? []).length;
		const depthBefore = nesting;
		nesting += opens - closes;

		// Count control flow keywords with nesting bonus
		const keywords = trimmed.match(COGNITIVE_BOOST_KEYWORDS);
		if (keywords) {
			score += keywords.length * (1 + depthBefore);
		}
	}

	return score;
}

/**
 * Compute cyclomatic complexity.
 * Counts decision points: if, else-if, for, while, catch, case.
 */
function computeCyclomaticComplexity(content: string): number {
	const matches = content.match(CYCLOMATIC_KEYWORDS);
	return 1 + (matches?.length ?? 0);
}

/**
 * Compute maximum nesting depth.
 */
function computeMaxNestingDepth(content: string): number {
	let depth = 0;
	let maxDepth = 0;
	for (const char of content) {
		if (char === "{") {
			depth++;
			maxDepth = Math.max(maxDepth, depth);
		} else if (char === "}") {
			depth--;
		}
	}
	return maxDepth;
}

/**
 * Compute Maintainability Index (MI).
 * Simplified: MI = max(0, (171 - 5.2*ln(Halstead) - 0.23*Cyclomatic - 16.2*ln(LOC)) * 100 / 171)
 * We use a proxy based on LOC and cyclomatic complexity.
 */
function computeMaintainabilityIndex(loc: number, cyclomatic: number): number {
	const mi = 171 - 5.2 * Math.log(Math.max(1, loc)) - 0.23 * cyclomatic;
	return Math.max(0, Math.min(100, mi));
}

/**
 * Analyze a single file for complexity metrics.
 */
export function analyzeFile(filePath: string): FileComplexity | null {
	try {
		const content = readFileSync(filePath, "utf-8");
		const lines = content.split("\n");
		const loc = lines.filter((l) => l.trim().length > 0).length;
		const cognitiveComplexity = computeCognitiveComplexity(content);
		const cyclomaticComplexity = computeCyclomaticComplexity(content);
		const maxNestingDepth = computeMaxNestingDepth(content);
		const maintainabilityIndex = computeMaintainabilityIndex(loc, cyclomaticComplexity);

		return {
			filePath,
			linesOfCode: loc,
			cognitiveComplexity,
			cyclomaticComplexity,
			maxNestingDepth,
			maintainabilityIndex,
		};
	} catch {
		return null;
	}
}
