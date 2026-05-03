/**
 * Welcome Screen Extension
 *
 * Replaces pi's built-in startup header with a beautiful welcome screen
 * showing pi branding, version, shortcuts, working directory, and model info.
 * Transitions to a minimal header after the first user interaction.
 *
 * Commands:
 *   /welcome      - Show the full welcome header
 *
 * Flags:
 *   --welcome     - Always show full welcome header (never auto-minimize)
 */

import { VERSION, type ExtensionAPI, type Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import friendlyErrors from "./friendly-errors.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Returns a colored key hint like "Ctrl+L  Model". */
function hint(theme: Theme, key: string, desc: string): string {
	return `  ${theme.fg("accent", key)}  ${theme.fg("text", desc)}`;
}

/** Pretty-print a path, shortening home to ~. */
function prettyPath(p: string): string {
	const home = process.env.HOME || "";
	if (p.startsWith(home)) return "~" + p.slice(home.length);
	return p;
}

/** Format timestamp as HH:MM */
function fmtTime(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Welcome header component ────────────────────────────────────────────

interface State {
	/** Whether to show the full welcome or a minimal header. */
	welcomeMode: boolean;
	/** Whether the user has submitted a prompt yet (auto-minimize). */
	hasInteracted: boolean;
	/** Whether --welcome flag is set (never auto-minimize). */
	pinWelcome: boolean;
	/** Stored during session_start for display. */
	modelLabel: string;
	/** Stored during session_start. */
	cwd: string;
}

function makeWelcomeHeader(state: State) {
	return (_tui: unknown, theme: Theme) => {
		return {
			render(width: number): string[] {
				// Minimal mode: just a compact π + version + model
				if (!state.welcomeMode) {
					const piSym = theme.fg("accent", "π");
					const ver = theme.fg("dim", `v${VERSION}`);
					const model = state.modelLabel ? theme.fg("dim", ` • ${state.modelLabel}`) : "";
					const time = theme.fg("dim", `  ${fmtTime()}`);
					const line = `  ${piSym}  ${ver}${model}${time}`;
					return [truncateToWidth(line, width), ""];
				}

				// ── Full welcome mode ─────────────────────────────
				const lines: string[] = [];
				const contentWidth = Math.min(width, 100);

				// Top border
				lines.push(theme.fg("borderAccent", `┌${"─".repeat(contentWidth - 2)}┐`));

				// Empty line
				lines.push(theme.fg("borderAccent", "│") + " ".repeat(contentWidth - 2) + theme.fg("borderAccent", "│"));

				// Pi logo + version
				const logoStr = `  ${theme.fg("accent", "π")}  ${theme.bold(theme.fg("text", "Pi Coding Agent"))}`;
				const verStr = theme.fg("dim", `v${VERSION}`);
				const logoLine = logoStr + " ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(logoStr) - visibleWidth(verStr))) + verStr;
				lines.push(theme.fg("borderAccent", "│") + logoLine + theme.fg("borderAccent", "│"));

				lines.push(theme.fg("borderAccent", "│") + " ".repeat(contentWidth - 2) + theme.fg("borderAccent", "│"));

				// Model info
				if (state.modelLabel) {
					const modelLine = `  ${theme.fg("dim", "Model:")} ${theme.fg("text", state.modelLabel)}`;
					lines.push(
						theme.fg("borderAccent", "│") +
							truncateToWidth(modelLine, contentWidth - 2) +
							" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(truncateToWidth(modelLine, contentWidth - 2)))) +
							theme.fg("borderAccent", "│"),
					);
				}

				// Working directory
				const cwdStr = `  ${theme.fg("dim", "CWD:")} ${theme.fg("muted", prettyPath(state.cwd))}`;
				lines.push(
					theme.fg("borderAccent", "│") +
						truncateToWidth(cwdStr, contentWidth - 2) +
						" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(truncateToWidth(cwdStr, contentWidth - 2)))) +
						theme.fg("borderAccent", "│"),
				);

				// Separator
				lines.push(
					theme.fg("borderAccent", "│") +
						theme.fg("borderMuted", "─".repeat(contentWidth - 4)) +
						theme.fg("borderAccent", "│"),
				);

				// Quick start
				const quickStart = `  ${theme.bold(theme.fg("text", "Quick Start"))}`;
				lines.push(
					theme.fg("borderAccent", "│") +
						quickStart +
						" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(quickStart))) +
						theme.fg("borderAccent", "│"),
				);

				lines.push(
					theme.fg("borderAccent", "│") +
						"  " +
						theme.fg("text", "Type your request and press ") +
						theme.fg("accent", "Enter") +
						theme.fg("text", " to start") +
						" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth("  Type your request and press Enter to start"))) +
						theme.fg("borderAccent", "│"),
				);

				lines.push(
					theme.fg("borderAccent", "│") +
						"  " +
						theme.fg("text", 'Use ') +
						theme.fg("accent", "@filename") +
						theme.fg("text", ' to reference files') +
						" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth('  Use @filename to reference files'))) +
						theme.fg("borderAccent", "│"),
				);

				// Separator
				lines.push(
					theme.fg("borderAccent", "│") +
						theme.fg("borderMuted", "─".repeat(contentWidth - 4)) +
						theme.fg("borderAccent", "│"),
				);

				// Shortcuts
				const shortcuts = [
					["Ctrl+L", "Switch models"],
					["Ctrl+P", "Cycle models"],
					["Ctrl+O", "Toggle tool output"],
					["Ctrl+T", "Toggle thinking blocks"],
					["Esc", "Cancel / abort"],
					["/hotkeys", "All shortcuts"],
				];

				const header = `  ${theme.bold(theme.fg("text", "Shortcuts"))}`;
				lines.push(
					theme.fg("borderAccent", "│") +
						header +
						" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(header))) +
						theme.fg("borderAccent", "│"),
				);

				// Two-column layout for shortcuts
				const half = Math.ceil(shortcuts.length / 2);
				for (let i = 0; i < half; i++) {
					const left = shortcuts[i]!;
					const right = i + half < shortcuts.length ? shortcuts[i + half]! : null;
					const leftStr = hint(theme, left[0], left[1]);
					const rightStr = right ? hint(theme, right[0], right[1]) : "";

					const colWidth = Math.floor((contentWidth - 4) / 2);
					const leftPadded = truncateToWidth(leftStr, colWidth);
					const rightPadded = rightStr ? truncateToWidth(rightStr, colWidth) : "";

					const lineStr = "  " + leftPadded + " ".repeat(Math.max(1, colWidth - visibleWidth(leftPadded))) + rightPadded;
					lines.push(
						theme.fg("borderAccent", "│") +
							truncateToWidth(lineStr, contentWidth - 2) +
							" ".repeat(Math.max(1, contentWidth - 2 - visibleWidth(truncateToWidth(lineStr, contentWidth - 2)))) +
							theme.fg("borderAccent", "│"),
					);
				}

				// Bottom border
				lines.push(theme.fg("borderAccent", "│") + " ".repeat(contentWidth - 2) + theme.fg("borderAccent", "│"));
				lines.push(theme.fg("borderAccent", `└${"─".repeat(contentWidth - 2)}┘`));
				lines.push("");

				return lines;
			},
			invalidate() {},
		};
	};
}

// ─── Extension ───────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const state: State = {
		welcomeMode: true,
		hasInteracted: false,
		pinWelcome: false,
		modelLabel: "",
		cwd: process.cwd(),
	};

	// Check for --welcome flag
	state.pinWelcome = pi.getFlag("welcome") === true;

	// Register the --welcome flag
	pi.registerFlag("welcome", {
		description: "Always show full welcome header (never auto-minimize)",
		type: "boolean",
		default: false,
	});

	// On session start, set up the welcome header
	pi.on("session_start", async (event, ctx) => {
		if (!ctx.hasUI) return;

		state.cwd = ctx.cwd;

		// Only show full welcome on fresh startup or new sessions
		const isFreshStart = event.reason === "startup" || event.reason === "new";
		state.welcomeMode = isFreshStart;
		state.hasInteracted = false;

		// Capture model info
		if (ctx.model) {
			const provider = ctx.model.provider;
			const modelId = ctx.model.id;
			state.modelLabel = `${provider}/${modelId}`;
		} else {
			state.modelLabel = "";
		}

		// Set the custom header (always set so we stay in control of the header)
		ctx.ui.setHeader(makeWelcomeHeader(state));

		// Show a welcome notification on fresh start
		if (isFreshStart) {
			ctx.ui.notify(
				`π v${VERSION} ready — type your request or /welcome for shortcuts`,
				"info",
			);
		}
	});

	// Listen for first user input to auto-minimize
	pi.on("input", async (event, ctx) => {
		if (state.hasInteracted) return { action: "continue" };
		if (!event.text.trim()) return { action: "continue" };

		state.hasInteracted = true;

		// Auto-minimize welcome after first interaction (unless pinned)
		if (!state.pinWelcome) {
			state.welcomeMode = false;
			// Request a re-render so the header updates
			if (ctx.hasUI) {
				// The header reference callback handles state, just invalidate
			}
		}

		return { action: "continue" };
	});

	// Track model changes
	pi.on("model_select", async (event, _ctx) => {
		if (event.model) {
			state.modelLabel = `${event.model.provider}/${event.model.id}`;
		}
	});

	// ── /welcome command: re-show the full welcome header ──────
	pi.registerCommand("welcome", {
		description: "Show the full welcome header",
		handler: async (_args, ctx) => {
			state.welcomeMode = true;
			ctx.ui.notify("Welcome header shown", "info");
		},
	});

	// ── Friendly error handling (all tools) ──────────────────
	friendlyErrors(pi);
}
