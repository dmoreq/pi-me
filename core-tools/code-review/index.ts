/**
 * Code Review — Extension entry.
 *
 * Registers the /code-review command that runs a comprehensive
 * codebase health assessment: complexity, TODO inventory, TDI.
 *
 * Saves report to `.pi/reviews/` and notifies the user.
 *
 * Profile: full only (subset B in core-tools umbrella).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { analyzeFile } from "./complexity.ts";
import { scanTodos } from "./todo-scanner.ts";
import { computeTDI } from "./tdi.ts";
import { buildReport, saveReport } from "./reporter.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("code-review", {
		description:
			"Run a full codebase health assessment: complexity analysis, " +
			"TODO/FIXME inventory, and Technical Debt Index (TDI). " +
			"Results saved to .pi/reviews/. Usage: /code-review",
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd ?? process.cwd();
			ctx.ui.notify("🔍 Starting code review...", "info");

			// Discover source files
			const { readdirSync } = await import("node:fs");
			const { join, extname } = await import("node:path");
			const SOURCE_EXTS = new Set([
				".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".rb",
				".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
			]);
			const sourceFiles: string[] = [];

			function scan(dir: string): void {
				let entries: string[];
				try {
					entries = readdirSync(dir, { withFileTypes: true });
				} catch {
					return;
				}
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					if (entry.isDirectory()) {
						if (
							entry.name.startsWith(".") ||
							entry.name === "node_modules" ||
							entry.name === "dist"
						) {
							continue;
						}
						scan(fullPath);
					} else if (SOURCE_EXTS.has(extname(entry.name))) {
						sourceFiles.push(fullPath);
					}
				}
			}

			scan(cwd);

			if (sourceFiles.length === 0) {
				ctx.ui.notify("No source files found to analyze.", "warning");
				return;
			}

			ctx.ui.notify(
				`Analyzing ${sourceFiles.length} source files...`,
				"info",
			);

			// Complexity analysis
			const complexities = sourceFiles
				.map((f) => analyzeFile(f))
				.filter((c): c is NonNullable<typeof c> => c !== null);

			ctx.ui.notify(
				`Complexity analysis complete (${complexities.length} files). Scanning TODOs...`,
				"info",
			);

			// TODO scanning
			const todos = scanTodos(cwd);

			// TDI computation
			const tdi = computeTDI(complexities, todos);

			// Build and save report
			const report = buildReport({ tdi, complexities, todos, projectRoot: cwd });
			const reportPath = saveReport(report, cwd);

			// Notify user
			const emoji = tdi.score <= 30 ? "🔴" : tdi.score <= 60 ? "🟡" : "✅";
			ctx.ui.notify(
				`${emoji} Code review complete. TDI: ${tdi.score}/100 (${tdi.grade}). Report saved to ${reportPath}`,
				"info",
			);

			// Also print to stdout for immediate visibility
			console.log(
				`\n📊 TECHNICAL DEBT INDEX: ${tdi.score}/100 (${tdi.grade})`,
			);
			console.log(`Files analyzed: ${tdi.filesAnalyzed}`);
			console.log(`Files with debt: ${tdi.filesWithDebt}`);
			console.log(`Average MI: ${tdi.avgMI}`);
			console.log(`Total cognitive complexity: ${tdi.totalCognitive}`);
			console.log(`Total TODO/FIXME: ${tdi.totalTodos}`);
			console.log(`\nReport saved to: ${reportPath}\n`);
		},
	});
}
