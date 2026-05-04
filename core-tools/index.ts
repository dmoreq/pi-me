/**
 * core-tools — Umbrella entry point.
 *
 * Profile: dev loads subset A; full loads subset A + subset B.
 * Subset A: task-orchestration, plan-mode, memory, formatter,
 *           thinking-steps, edit-session, clipboard, preset,
 *           code-actions, read-guard.
 * Subset B: sub-pi, subagent, ralph-loop, web-search, file-collector,
 *           ast-grep, code-review, autofix.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.js";
import { getTelemetry } from "pi-telemetry";

// ── Subset A — dev + full ────────────────────────────────────────────────

import taskOrchestration from "./task-orchestration/src/index.ts";
import planMode from "./plan-mode.ts";
import memory from "./memory/index.ts";
import formatter from "./formatter/extensions/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";
import editSession from "./edit-session/extensions/edit-session-in-place.ts";
import preset from "./preset/index.ts";
import codeActions from "./code-actions/index.ts";
import readGuard from "./read-guard/index.ts";
import { registerClipboard } from "./clipboard.ts";

// ── Subset B — full only ─────────────────────────────────────────────────

import subPi from "./sub-pi/index.ts";
import subagent from "./subagent/extension/index.ts";
import ralphLoop from "./ralph-loop/ralph-loop.ts";
import webSearch from "./web-search.ts";
import fileCollector from "./file-collector/index.ts";
import astGrepTools from "./ast-grep-tool/index.ts";
import codeReview from "./code-review/index.ts";
import autofix from "./autofix/index.ts";

// ── Umbrella default export ──────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "core-tools",
			version: "0.3.0",
			description: "Pi-me core tool suite: task orchestration, planning, memory, editing, code review, subagent, and more",
			tools: ["read", "edit", "write", "bash", "search", "copy_to_clipboard"],
			events: ["session_start", "tool_call", "message_end", "session_shutdown"],
		});
	}

	// Subset A — dev + full
	taskOrchestration(pi);
	planMode(pi);
	memory(pi);
	formatter(pi);
	thinkingSteps(pi);
	editSession(pi);
	registerClipboard(pi);
	preset(pi);
	codeActions(pi);
	readGuard(pi);

	// Subset B — full only
	if (profile === "full") {
		subPi(pi);
		subagent(pi);
		ralphLoop(pi);
		webSearch(pi);
		fileCollector(pi);
		astGrepTools(pi);
		codeReview(pi);
		autofix(pi);
	}
}
