/**
 * btw-task — Extension entry point.
 *
 * Composes the full btw-task system:
 *   - /btw command (manual task entry)
 *   - /btw-clear command (cleanup)
 *   - Input hook (natural language "btw" detection)
 *   - Widget lifecycle
 *
 * Flow:
 *   User: "/btw fix login, refactor db, update docs"
 *     │
 *     ├─► input-parser → ["fix login", "refactor db", "update docs"]
 *     ├─► planner → groups: [[fix login], [refactor db, update docs]]
 *     ├─► widget shows 3 tasks ○ pending
 *     └─► executor → group 1 sequentially, group 2 in parallel
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { parseBtwInput } from "./input-parser.ts";
import { planTasks } from "./planner.ts";
import { clearTasks, clearCompleted, getTasks } from "./state.ts";
import { BtwWidget, formatTasksForNotify } from "./widget.ts";
import { executeGroups } from "./executor.ts";

export default function (pi: ExtensionAPI) {
	const widget = new BtwWidget();

	// ── /btw command ─────────────────────────────────────────
	pi.registerCommand("btw", {
		description: "Add and execute btw tasks: /btw fix login, refactor db, update docs",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/btw requires interactive mode", "error");
				return;
			}

			if (!args?.trim()) {
				ctx.ui.notify("Usage: /btw <task 1>, <task 2>, ...\n  e.g., /btw fix login, refactor db, update docs", "info");
				return;
			}

			// Parse the command arguments as task texts
			const fullText = `/btw ${args}`;
			const taskTexts = parseBtwInput(fullText);
			if (!taskTexts || taskTexts.length === 0) {
				ctx.ui.notify("No tasks detected. Try: /btw fix login, refactor db", "info");
				return;
			}

			await handleBtwTasks(taskTexts, ctx, widget);
		},
	});

	// ── /btw-clear command ────────────────────────────────────
	pi.registerCommand("btw-clear", {
		description: "Clear btw tasks. Use '/btw-clear completed' to clear only completed/failed.",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;

			const sub = args?.trim().toLowerCase();
			if (sub === "completed" || sub === "done") {
				const before = getTasks().length;
				clearCompleted();
				const after = getTasks().length;
				const removed = before - after;
				ctx.ui.notify(`🧹 Cleared ${removed} completed btw task${removed !== 1 ? "s" : ""}`, "info");
			} else {
				clearTasks();
				ctx.ui.notify("🧹 Cleared all btw tasks", "info");
			}
			widget.update();
		},
	});

	// ── Input hook: detect natural language "btw" ─────────────
	pi.on("input", async (event, ctx) => {
		const taskTexts = parseBtwInput(event.text);
		if (!taskTexts || taskTexts.length === 0) {
			return { action: "continue" };
		}

		// We have btw tasks — handle them without blocking the input
		void handleBtwTasks(taskTexts, ctx as any, widget);

		return { action: "continue" };
	});

	// ── Widget lifecycle ───────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		widget.setUICtx(ctx.ui);
		widget.update();
	});

	pi.on("session_shutdown", async () => {
		widget.dispose();
	});
}

// ─── Core flow: parse → plan → show → execute ─────────────────────────

// Re-entrancy guard: only one btw execution at a time
let executing = false;

async function handleBtwTasks(
	taskTexts: string[],
	ctx: { hasUI: boolean; ui: { notify: (msg: string, type?: "error" | "info" | "warning") => void; setStatus: (k: string, v?: string) => void; theme: any }; cwd: string },
	widget: BtwWidget,
): Promise<void> {
	if (executing) {
		ctx.ui.notify("⏳  Btw tasks are already running. Wait for them to finish.", "warning");
		return;
	}

	executing = true;

	try {
		// 1. Plan: add tasks to state, build groups
		const plan = planTasks(taskTexts);
		if (plan.groups.length === 0) {
			ctx.ui.notify("No tasks to execute.", "info");
			return;
		}

		// 2. Show widget
		widget.update();

		const total = taskTexts.length;
		const parallelGroups = plan.groups.filter((g) => g.tasks.length > 1).length;
		const summary = parallelGroups > 0
			? `${total} task${total !== 1 ? "s" : ""} in ${plan.groups.length} group${plan.groups.length !== 1 ? "s" : ""} (${parallelGroups} parallel)`
			: `${total} task${total !== 1 ? "s" : ""}`;

		ctx.ui.notify(`📋  Planning: ${summary}`, "info");

		// 3. Execute groups sequentially, tasks within parallel
		await executeGroups(plan.groups, ctx as any, { widget, cwd: ctx.cwd });

	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		ctx.ui.notify(`⚠️  Btw execution error: ${msg}`, "error");
	} finally {
		executing = false;
		widget.update();
	}
}
