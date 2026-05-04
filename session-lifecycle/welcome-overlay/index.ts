/**
 * Welcome Overlay — Persistent welcome header for pi-me.
 *
 * Replaces the built-in collapsible header (ExpandableText with logo,
 * keybinding hints, and onboarding text) with a custom header that
 * stays permanently visible. The built-in header collapses when
 * toolOutputExpanded is false; this one never collapses.
 *
 * Hooks:
 * - "session_start" — sets a persistent custom header via ctx.ui.setHeader()
 *
 * Commands:
 * - /welcome-toggle   — Toggle welcome header on/off
 * - /welcome-builtin  — Restore built-in collapsible header
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "welcome-header";
let welcomeEnabled = true;

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		setWelcomeHeader(ctx);

		if (welcomeEnabled) {
			ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", "🖖  Welcome: on"));
		} else {
			ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", "🖖  Welcome: off"));
		}
	});

	// ── Commands ──────────────────────────────────────────────────────────

	pi.registerCommand("welcome-toggle", {
		description: "Toggle the persistent welcome header on/off",
		handler: async (_args, ctx) => {
			welcomeEnabled = !welcomeEnabled;
			if (welcomeEnabled) {
				setWelcomeHeader(ctx);
				ctx.ui.notify("Welcome header enabled", "info");
			} else {
				ctx.ui.setHeader(undefined);
				ctx.ui.notify("Welcome header disabled, built-in header restored", "info");
			}
			if (ctx.hasUI) {
				ctx.ui.setStatus(
					STATUS_KEY,
					ctx.ui.theme.fg("dim", welcomeEnabled ? "🖖  Welcome: on" : "🖖  Welcome: off"),
				);
			}
		},
	});

	pi.registerCommand("welcome-builtin", {
		description: "Restore the built-in collapsible startup header",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}

function setWelcomeHeader(ctx: { hasUI: boolean; ui: any }) {
	if (!ctx.hasUI) return;

	ctx.ui.setHeader((_tui: any, theme: any) => {
		// Build the welcome banner once and cache it
		const piBlue = (text: string) => theme.fg("accent", text);
		const dim = (text: string) => theme.fg("dim", text);
		const green = (text: string) => theme.fg("success", text);
		const yellow = (text: string) => theme.fg("warning", text);
		const cyan = (text: string) => theme.fg("accent", text);
		const muted = (text: string) => theme.fg("muted", text);

		const block = "█";
		const pupil = "▌";

		// Pi mascot eyes and body
		const eye = `${block}${pupil}`;
		const lineEyes = `     ${eye}  ${eye}`;
		const lineBar = `  ${piBlue(block.repeat(14))}`;
		const lineLeg = `     ${piBlue(block.repeat(2))}    ${piBlue(block.repeat(2))}`;

		const mascot = ["", lineEyes, lineBar, lineLeg, lineLeg, lineLeg, lineLeg];

		const shortcuts = [
			`${dim("Shortcuts:")}  ${yellow("Ctrl+I")} interrupt  ${yellow("Ctrl+L")} clear  ${yellow("Ctrl+D")} exit  ${yellow("/")} commands  ${yellow("!")} bash  ${green("Ctrl+O")} expand tools  ${cyan("Tab")} cycle model`,
		];

		const tips = [
			`${dim("Tip:")} Pi can explain its own features and look up its docs. Ask how to use or extend Pi.`,
		];

		const resources = [
			`${muted("Resources:")}  ${dim("Docs: /docs")}  ${dim("Skills: /skills")}  ${dim("Extensions: Ctrl+E")}`,
		];

		const spacer = "";

		const allLines = [...mascot, spacer, ...shortcuts, ...tips, ...resources, spacer];

		return {
			render(_width: number): string[] {
				return allLines;
			},
			invalidate() {},
		};
	});
}
