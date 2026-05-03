/**
 * btw-task — Live todo widget.
 *
 * Shows up to 3 most recent btw tasks above the editor.
 * Same pattern as TodoOverlay in core-tools/todo/todo-overlay.ts.
 * Auto-hides when empty.
 *
 * Status badges:
 *   ○ pending
 *   ◎ in_progress
 *   ✓ completed
 *   ✕ failed
 */

import type { ExtensionUIContext, Theme } from "@mariozechner/pi-coding-agent";
import type { TUI } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { BtwTask } from "./types.ts";
import { getRecent } from "./state.ts";

// ─── Constants ──────────────────────────────────────────────────────────

const WIDGET_KEY = "btw-tasks";
const MAX_TASKS = 3;

const STATUS_ICON: Record<string, string> = {
	pending: "○",
	in_progress: "◎",
	completed: "✓",
	failed: "✕",
};

// ─── Widget ─────────────────────────────────────────────────────────────

export class BtwWidget {
	private uiCtx: ExtensionUIContext | undefined;
	private registered = false;
	private tui: TUI | undefined;

	setUICtx(ctx: ExtensionUIContext): void {
		if (ctx !== this.uiCtx) {
			this.uiCtx = ctx;
			this.registered = false;
			this.tui = undefined;
		}
	}

	update(): void {
		if (!this.uiCtx) return;

		const recent = getRecent(MAX_TASKS);
		if (recent.length === 0) {
			if (this.registered) {
				this.uiCtx.setWidget(WIDGET_KEY, undefined);
				this.registered = false;
				this.tui = undefined;
			}
			return;
		}

		if (!this.registered) {
			this.uiCtx.setWidget(
				WIDGET_KEY,
				(tui: TUI, theme: Theme) => {
					this.tui = tui;
					return {
						render: (width: number) => this.renderWidget(theme, width),
						invalidate: () => {
							this.registered = false;
							this.tui = undefined;
						},
					};
				},
				{ placement: "aboveEditor" },
			);
			this.registered = true;
		} else {
			this.tui?.requestRender();
		}
	}

	private renderWidget(theme: Theme, width: number): string[] {
		const recent = getRecent(MAX_TASKS);
		if (recent.length === 0) return [];

		const lines: string[] = [""];

		for (const task of recent) {
			const icon = STATUS_ICON[task.status] ?? "○";
			const statusColor = this.statusColor(theme, task.status);
			const row = `  ${statusColor} ${this.truncateTask(task.text, width - 6)}`;
			lines.push(row);
		}

		return lines;
	}

	private statusColor(theme: Theme, status: string): string {
		switch (status) {
			case "in_progress":
				return theme.fg("accent", STATUS_ICON[status]!);
			case "completed":
				return theme.fg("success", STATUS_ICON[status]!);
			case "failed":
				return theme.fg("error", STATUS_ICON[status]!);
			default:
				return theme.fg("dim", STATUS_ICON[status]!);
		}
	}

	private truncateTask(text: string, maxWidth: number): string {
		const display = text.length > maxWidth ? text.slice(0, maxWidth - 1) + "…" : text;
		return display;
	}

	dispose(): void {
		if (this.uiCtx && this.registered) {
			try {
				this.uiCtx.setWidget(WIDGET_KEY, undefined);
			} catch {
				// session may have ended
			}
		}
		this.registered = false;
		this.tui = undefined;
		this.uiCtx = undefined;
	}
}

// ─── Status helper (for commands) ───────────────────────────────────────

export function formatTasksForNotify(tasks: BtwTask[]): string {
	if (tasks.length === 0) return "No btw tasks.";

	return tasks
		.map((t) => {
			const icon = STATUS_ICON[t.status] ?? "○";
			return `${icon} ${t.text}`;
		})
		.join("\n");
}
