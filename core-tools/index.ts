/**
 * core-tools — Umbrella entry point.
 *
 * Profile: dev loads subset A; full loads subset A + subset B.
 * Subset A: task-orchestration, planning, memory,
 *           thinking-steps, clipboard, code-quality,
 *           file-intelligence, subprocess-orchestrator.
 * Subset B: file-collector, ast-grep, code-review, autofix.
 *
 * v0.4.0: Removed preset, edit-session (dead extensions from v0.3.0)
 * v0.6.0: Deprecated subagent, sub-pi, sub-pi-skill, ralph-loop, web-search
 * v0.7.0: Removed subagent, sub-pi, sub-pi-skill, ralph-loop, web-search
 *          → All consolidated into subprocess-orchestrator (subset A) and web-tools (content-tools)
 * v0.8.0: Removed formatter TUI extension (merged into code-quality pipeline)
 *          Removed read-guard, context-pruning, welcome-overlay, session-name, context-window
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.js";
import { getTelemetry } from "pi-telemetry";

// ── Subset A — dev + full ────────────────────────────────────────────────

import taskOrchestration from "./task-orchestration/src/index.ts";
import planMode from "./plan-mode.ts";
import memory from "./memory/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";
import codeQuality from "./code-quality/index.ts";
import fileIntelligence from "./file-intelligence/index.ts";
// code-actions: removed in v0.8.0 (redundant with built-in TUI snippet experience)
import subprocessOrchestrator from "./subprocess-orchestrator/index.ts";
// read-guard: merged into context-intel plugins (Phase 3)
import { registerClipboard } from "./clipboard.ts";

// ── Subset B — full only ─────────────────────────────────────────────────

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
			version: "0.7.0",
			description: "Pi-me core tool suite: task orchestration, planning, memory, formatting, code quality, file intelligence, code review, subprocess orchestration, and more",
			tools: ["read", "edit", "write", "bash", "search", "copy_to_clipboard", "subprocess"],
			events: ["session_start", "tool_call", "message_end", "session_shutdown"],
		});
	}

	// Subset A — dev + full
	taskOrchestration(pi);
	planMode(pi);
	memory(pi);
	thinkingSteps(pi);
	codeQuality(pi);
	fileIntelligence(pi);
	// read-guard: now loaded via ContextIntelExtension plugins
	registerClipboard(pi);
	subprocessOrchestrator(pi);

	// Subset B — full only (v0.7.0: removed deprecated subagent/sub-pi/ralph/web-search)
	if (profile === "full") {
		fileCollector(pi);
		astGrepTools(pi);
		codeReview(pi);
		autofix(pi);
	}
}
