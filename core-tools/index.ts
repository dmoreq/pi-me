/**
 * core-tools — Umbrella entry point.
 *
 * Profile: dev loads subset A; full loads subset A + subset B.
 * Subset A: task-orchestration, planning, memory, thinking-steps, clipboard,
 *           code-quality (8 auto-formatters + 3 auto-fixers), file-intelligence, subprocess-orchestrator.
 * Subset B: file-collector, ast-grep, code-review.
 *
 * v0.4.0: Removed preset, edit-session (dead extensions from v0.3.0)
 * v0.6.0: Deprecated subagent, sub-pi, sub-pi-skill, ralph-loop, web-search
 * v0.7.0: Removed subagent, sub-pi, sub-pi-skill, ralph-loop, web-search
 *          → All consolidated into subprocess-orchestrator (subset A) and web-tools (content-tools)
 * v0.8.0: Removed formatter TUI extension (merged into code-quality pipeline)
 *          Removed read-guard, context-pruning, welcome-overlay, session-name, context-window
 * v0.9.0: Code quality consolidation — unified auto-format + auto-fix + pipeline + telemetry
 *          Merged: autofix/ (now removed) + formatter-runners/ (now runners/formatter/)
 *          New: runners/fix/ (3 auto-fixers), telemetry/ (badge notifications)
 *          Moved autofix from subset B → subset A (now always-on with code-quality)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.js";
import { getTelemetry } from "pi-telemetry";

// ── Subset A — dev + full ────────────────────────────────────────────────

import taskOrchestration from "./task-orchestration/src/index.ts";
import planMode from "./planning/plan-mode.ts";
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

// ── Umbrella default export ──────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "core-tools",
			version: "0.9.0",
			description: "Core tool suite: task orchestration, planning, memory, thinking-steps, code quality (unified 8 formatters + 3 fixers), file intelligence, subprocess orchestration, and more",
			tools: ["read", "edit", "write", "bash", "search", "copy_to_clipboard", "subprocess"],
			events: ["session_start", "tool_call", "message_end", "session_shutdown"],
		});
	}

	// Subset A — dev + full
	taskOrchestration(pi);
	planMode(pi);
	memory(pi);
	thinkingSteps(pi);
	codeQuality(pi);                     // Now includes auto-format (8) + auto-fix (3) + telemetry
	fileIntelligence(pi);
	registerClipboard(pi);
	subprocessOrchestrator(pi);

	// Subset B — full only (v0.7.0: removed deprecated subagent/sub-pi/ralph/web-search)
	// Note: autofix moved to subset A in v0.9.0 — now unified with code-quality
	if (profile === "full") {
		fileCollector(pi);
		astGrepTools(pi);
		codeReview(pi);
	}
}
