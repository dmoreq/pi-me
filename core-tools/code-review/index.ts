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
import { createTaskIntentDetector } from "../intent/detector.ts";
import type { TaskIntent } from "../intent/types.ts";

// ─── Review scope per intent ───────────────────────────────────────────────

/**
 * Defines what analysis modules to run and what to prioritize based on intent.
 */
interface ReviewScope {
  label: string;
  emoji: string;
  /** Analysis modules to enable */
  modules: Set<"complexity" | "todos" | "tdi" | "security">;
  /** File patterns to prioritize (glob-ish keywords) */
  focusPatterns?: RegExp[];
  /** Description for the report */
  description: string;
}

const REVIEW_SCOPES: Record<TaskIntent, ReviewScope> = {
  fix: {
    label: "Bug Fix Review",
    emoji: "🐛",
    modules: new Set(["complexity", "todos", "tdi"]),
    focusPatterns: [/error/i, /exception/i, /crash/i, /bug/i, /fail/i],
    description: "Focused review for bug-prone code: high-complexity files, error handling, and known TODOs.",
  },
  refactor: {
    label: "Refactor Review",
    emoji: "♻️",
    modules: new Set(["complexity", "todos"]),
    focusPatterns: [/complexity/i, /cognitive/i, /cyclomatic/i],
    description: "Focused on complexity hotspots and technical debt ripe for refactoring.",
  },
  test: {
    label: "Test Coverage Review",
    emoji: "🧪",
    modules: new Set(["todos", "tdi"]),
    description: "Checking test gaps, missing specs, and test-related TODOs.",
  },
  docs: {
    label: "Documentation Review",
    emoji: "📝",
    modules: new Set(["todos"]),
    focusPatterns: [/doc/i, /readme/i, /comment/i, /guide/i],
    description: "Reviewing documentation gaps and doc-related TODOs.",
  },
  deploy: {
    label: "Deploy Readiness Review",
    emoji: "🚀",
    modules: new Set(["complexity", "todos", "tdi"]),
    description: "Pre-deployment health check: debt, blockers, and release readiness.",
  },
  analyze: {
    label: "Full Code Analysis",
    emoji: "🔍",
    modules: new Set(["complexity", "todos", "tdi"]),
    description: "Comprehensive analysis across all metrics.",
  },
  implement: {
    label: "New Code Review",
    emoji: "✨",
    modules: new Set(["complexity", "todos"]),
    focusPatterns: [/new/i, /add/i, /implement/i, /feature/i],
    description: "Reviewing new feature code for complexity and completeness.",
  },
  general: {
    label: "General Code Review",
    emoji: "👁️",
    modules: new Set(["complexity", "todos", "tdi"]),
    description: "Standard codebase health assessment.",
  },
};

export default function (pi: ExtensionAPI) {
	const detector = createTaskIntentDetector();

	pi.registerCommand("code-review", {
		description:
			"Run a codebase health assessment: complexity analysis, " +
			"TODO/FIXME inventory, and Technical Debt Index (TDI). " +
			"Detects review focus from context. " +
			"Results saved to .pi/reviews/. Usage: /code-review [focus]",
		handler: async (args, ctx) => {
			const cwd = ctx.cwd ?? process.cwd();

			// Detect review scope: from explicit arg or from recent conversation context
			let scopeIntent: TaskIntent = "analyze";
			let scopeSource = "default";

			if (args && args.trim()) {
				// Explicit focus argument "/code-review fix"
				const explicitResult = detector.detector.classify(args);
				scopeIntent = explicitResult;
				scopeSource = "explicit";
			} else {
				// Try to infer from recent messages
				try {
					const messages = (ctx as any)?.messages ?? [];
					const recentUserMsg = messages
						.filter((m: any) => m.role === "user")
						.pop();
					if (recentUserMsg?.content) {
						const result = await detector.detector.classifyAsync(recentUserMsg.content);
						scopeIntent = result.intent;
						scopeSource = result.source;
					}
				} catch {
					// Use default scope
				}
			}

			const scope = REVIEW_SCOPES[scopeIntent] ?? REVIEW_SCOPES.general;

			ctx.ui.notify(
				`${scope.emoji} ${scope.label} (${scopeSource}) — ${scope.description}`,
				"info",
			);

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

			const runModules = scope.modules;

			// Complexity analysis (conditional on scope)
			let complexities: any[] = [];
			if (runModules.has("complexity")) {
				ctx.ui.notify(
					`Analyzing ${sourceFiles.length} source files for complexity...`,
					"info",
				);
				complexities = sourceFiles
					.map((f) => analyzeFile(f))
					.filter((c): c is NonNullable<typeof c> => c !== null);
				ctx.ui.notify(
					`Complexity analysis complete (${complexities.length} files).`,
					"info",
				);
			}

			// Filter files by focus patterns if scope has them
			let filteredFiles = sourceFiles;
			if (scope.focusPatterns && scope.focusPatterns.length > 0) {
				filteredFiles = sourceFiles.filter(f =>
					scope.focusPatterns!.some(p => p.test(f)),
				);
				if (filteredFiles.length > 0) {
					ctx.ui.notify(
						`Focusing analysis on ${filteredFiles.length} relevant files.`,
						"info",
					);
				}
			}

			// TODO scanning (conditional on scope)
			let todos: any[] = [];
			if (runModules.has("todos")) {
				todos = scanTodos(cwd);
				ctx.ui.notify(`Found ${todos.length} TODO/FIXME items.`, "info");
			}

			// TDI computation (conditional on scope)
			let tdi = { score: 0, grade: "N/A", filesAnalyzed: 0, filesWithDebt: 0, avgMI: 0, totalCognitive: 0, totalTodos: 0 };
			if (runModules.has("tdi")) {
				tdi = computeTDI(complexities, todos);
			}

			// Build and save report
			const report = buildReport({
				tdi,
				complexities,
				todos,
				projectRoot: cwd,
				reviewScope: {
					intent: scopeIntent,
					label: scope.label,
					description: scope.description,
					source: scopeSource,
				},
			});
			const reportPath = saveReport(report, cwd);

			// Notify user
			const emoji = tdi.score <= 30 ? "🔴" : tdi.score <= 60 ? "🟡" : "✅";
			ctx.ui.notify(
				`${scope.emoji} ${tdi.score ? `TDI: ${tdi.score}/100 (${tdi.grade}). ` : ""}Report saved to ${reportPath}`,
				"info",
			);

			// Also print to stdout for immediate visibility
			console.log(`\n📊 REVIEW: ${scope.label} (${scopeSource})`);
			if (tdi.score) {
				console.log(`TECHNICAL DEBT INDEX: ${tdi.score}/100 (${tdi.grade})`);
				console.log(`Files analyzed: ${tdi.filesAnalyzed}`);
				console.log(`Files with debt: ${tdi.filesWithDebt}`);
				console.log(`Average MI: ${tdi.avgMI}`);
				console.log(`Total cognitive complexity: ${tdi.totalCognitive}`);
			}
			console.log(`Total TODO/FIXME: ${tdi.totalTodos}`);
			console.log(`Run modules: ${[...runModules].join(", ")}`);
			console.log(`\nReport saved to: ${reportPath}\n`);
		},
	});
}
