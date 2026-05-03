/**
 * Code review report formatter.
 *
 * Formats analysis results into markdown and saves to `.pi/reviews/`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { FileComplexity } from "./complexity.ts";
import type { TDIResult } from "./tdi.ts";
import type { TodoSummary } from "./todo-scanner.ts";

export interface CodeReviewInput {
	tdi: TDIResult;
	complexities: FileComplexity[];
	todos: TodoSummary;
	projectRoot: string;
}

/**
 * Format the TDI score as an emoji + label.
 */
function formatTdiSummary(tdi: TDIResult): string {
	if (tdi.score <= 30) return "🔴 High debt — recommend refactoring";
	if (tdi.score <= 60) return "🟡 Moderate debt — monitor";
	if (tdi.score <= 80) return "🟢 Healthy — minor improvements";
	return "✅ Excellent";
}

/**
 * Format complexity warnings for files exceeding thresholds.
 */
function formatComplexityWarnings(complexities: FileComplexity[], projectRoot: string): string[] {
	const warnings: string[] = [];
	for (const c of complexities) {
		const relPath = c.filePath.replace(projectRoot, ".").replace(/^\//, "");
		const issues: string[] = [];
		if (c.cognitiveComplexity > 20) issues.push(`cognitive=${c.cognitiveComplexity}`);
		if (c.cyclomaticComplexity > 15) issues.push(`cyclomatic=${c.cyclomaticComplexity}`);
		if (c.maxNestingDepth > 4) issues.push(`nesting=${c.maxNestingDepth}`);
		if (c.maintainabilityIndex < 60) issues.push(`MI=${Math.round(c.maintainabilityIndex)}`);
		if (issues.length > 0) {
			warnings.push(`  - \`${relPath}\`: ${issues.join(", ")}`);
		}
	}
	return warnings;
}

/**
 * Build the full markdown report.
 */
export function buildReport(input: CodeReviewInput): string {
	const { tdi, complexities, todos, projectRoot } = input;
	const timestamp = new Date().toISOString();
	const lines: string[] = [];

	lines.push(`# Code Review Report`);
	lines.push(`**Date:** ${timestamp}`);
	lines.push(`**Project:** \`${projectRoot}\``);
	lines.push("");
	lines.push("## Technical Debt Index");
	lines.push("");
	lines.push(`**TDI Score: ${tdi.score}/100 (${tdi.grade})**`);
	lines.push(`**Status:** ${formatTdiSummary(tdi)}`);
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Files analyzed | ${tdi.filesAnalyzed} |`);
	lines.push(`| Files with debt | ${tdi.filesWithDebt} |`);
	lines.push(`| Average MI | ${tdi.avgMI} |`);
	lines.push(`| Total cognitive complexity | ${tdi.totalCognitive} |`);
	lines.push(`| TODO/FIXME count | ${tdi.totalTodos} |`);
	lines.push("");
	lines.push("### Category Breakdown");
	lines.push("");
	lines.push(`- Maintainability: ${tdi.byCategory.maintainability}/100`);
	lines.push(`- Cognitive complexity: ${tdi.byCategory.cognitive}/100`);
	lines.push(`- Nesting depth: ${tdi.byCategory.nesting}/100`);
	lines.push("");

	// Complexity hotspots
	const warnings = formatComplexityWarnings(complexities, projectRoot);
	if (warnings.length > 0) {
		lines.push("## Complexity Hotspots");
		lines.push("");
		for (const w of warnings) lines.push(w);
		lines.push("");
	}

	// TODO inventory
	if (todos.items.length > 0) {
		lines.push("## TODO/FIXME Inventory");
		lines.push("");
		lines.push(`**Total: ${todos.total}**`);
		lines.push("");
		lines.push("### By Type");
		for (const [type, count] of Object.entries(todos.byType).sort((a, b) => b[1] - a[1])) {
			lines.push(`- ${type}: ${count}`);
		}
		lines.push("");
		lines.push("### Items");
		for (const item of todos.items.slice(0, 30)) {
			const relPath = item.file.replace(projectRoot, ".").replace(/^\//, "");
			lines.push(`- \`${relPath}:${item.line}\` [${item.type}] ${item.text}`);
		}
		if (todos.items.length > 30) {
			lines.push(`- ... and ${todos.items.length - 30} more`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Save the report to `.pi/reviews/` and return the file path.
 */
export function saveReport(report: string, projectRoot: string): string {
	const reviewDir = join(projectRoot, ".pi", "reviews");
	mkdirSync(reviewDir, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filePath = join(reviewDir, `code-review-${timestamp}.md`);
	writeFileSync(filePath, report, "utf-8");
	return filePath;
}
