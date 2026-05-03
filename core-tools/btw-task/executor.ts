/**
 * btw-task — Parallel task executor.
 *
 * Takes planned TaskGroups from the planner and executes them:
 *   - Groups are sequential (group 2 waits for group 1)
 *   - Tasks within a group run in parallel via sub-pi
 *   - Progress is reported back to the widget
 */

import { spawn } from "node:child_process";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { BtwTask, TaskGroup } from "./types.ts";
import { updateTaskStatus } from "./state.ts";
import type { BtwWidget } from "./widget.ts";

// ─── Configuration ──────────────────────────────────────────────────────

/** Maximum parallel subprocesses per group. */
const MAX_PARALLEL = 4;

/** Timeout per task in ms (5 min). */
const TASK_TIMEOUT_MS = 300_000;

// ─── Execution ──────────────────────────────────────────────────────────

export interface ExecutorOptions {
	widget: BtwWidget;
	cwd?: string;
}

export interface TaskResult {
	taskId: number;
	text: string;
	success: boolean;
	output: string;
	durationMs: number;
}

/**
 * Execute task groups sequentially.
 * Each group's tasks run in parallel via sub-pi subprocesses.
 */
export async function executeGroups(
	groups: TaskGroup[],
	ctx: ExtensionContext,
	options: ExecutorOptions,
): Promise<TaskResult[]> {
	const allResults: TaskResult[] = [];

	for (const group of groups) {
		// Mark all tasks in group as in_progress
		for (const task of group.tasks) {
			updateTaskStatus(task.id, "in_progress");
		}
		options.widget.update();

		// Update footer status
		if (ctx.hasUI) {
			ctx.ui.setStatus("btw-exec", `▶  Running group ${group.id + 1}/${groups.length} (${group.tasks.length} task${group.tasks.length !== 1 ? "s" : ""})`);

			const notifyText = group.tasks.length > 1
				? `▶  Running ${group.tasks.length} tasks in parallel (group ${group.id + 1}/${groups.length})`
				: `▶  Running: ${group.tasks[0]?.text ?? "task"}`;
			ctx.ui.notify(notifyText, "info");
		}

		// Execute all tasks in this group in parallel
		const results = await Promise.all(
			group.tasks.map((task) =>
				executeSingleTask(task, options.cwd ?? ctx.cwd).then((result) => {
					allResults.push(result);
					updateTaskStatus(task.id, result.success ? "completed" : "failed");
					options.widget.update();
					return result;
				}),
			),
		);

		// Mark group status
		const allOk = results.every((r) => r.success);
		group.status = allOk ? "done" : "failed";

		// Clear status after group completes
		if (ctx.hasUI) {
			ctx.ui.setStatus("btw-exec", undefined);
		}
	}

	// Final notification
	if (ctx.hasUI) {
		const ok = allResults.filter((r) => r.success).length;
		const total = allResults.length;
		if (ok === total) {
			ctx.ui.notify(`✓ All ${total} btw task${total !== 1 ? "s" : ""} completed`, "info");
		} else {
			ctx.ui.notify(`${ok}/${total} btw task${total !== 1 ? "s" : ""} completed, ${total - ok} failed`, "warning");
		}
	}

	return allResults;
}

// ─── Single task execution ──────────────────────────────────────────────

/**
 * Execute a single task by spawning a pi subprocess.
 *
 * Runs: pi -p "task description"
 * Captures stdout/stderr, enforces timeout.
 */
function executeSingleTask(task: BtwTask, cwd: string): Promise<TaskResult> {
	const startTime = Date.now();

	return new Promise((resolve) => {
		const proc = spawn("pi", ["-p", task.text], {
			cwd,
			env: {
				...process.env,
				PI_OFFLINE: "1",
				// Avoid nested session noise
				PI_SKIP_VERSION_CHECK: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
		});

		let output = "";
		let timedOut = false;

		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
			// Give it a moment to die, then SIGKILL
			setTimeout(() => {
				try { proc.kill("SIGKILL"); } catch { /* already dead */ }
			}, 2000);
		}, TASK_TIMEOUT_MS);

		proc.stdout.on("data", (data: Buffer) => {
			output += data.toString();
			// Keep only last 4KB to avoid memory bloat
			if (output.length > 4096) {
				output = output.slice(-4096);
			}
		});

		proc.stderr.on("data", (data: Buffer) => {
			output += data.toString();
			if (output.length > 4096) {
				output = output.slice(-4096);
			}
		});

		proc.on("close", (code) => {
			clearTimeout(timeout);
			const durationMs = Date.now() - startTime;
			resolve({
				taskId: task.id,
				text: task.text,
				success: !timedOut && code === 0,
				output,
				durationMs,
			});
		});

		proc.on("error", (err) => {
			clearTimeout(timeout);
			const durationMs = Date.now() - startTime;
			resolve({
				taskId: task.id,
				text: task.text,
				success: false,
				output: err.message,
				durationMs,
			});
		});
	});
}
