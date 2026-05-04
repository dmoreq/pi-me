/**
 * core-tools — Umbrella entry point.
 *
 * Profile: dev loads subset A; full loads subset A + subset B.
 * Subset A: task-plan (unified), memory, thinking-steps, clipboard,
 *           code-quality (8 auto-formatters + 3 auto-fixers), file-intelligence, subprocess-orchestrator.
 * Subset B: file-collector, ast-grep, code-review.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.ts";
import { getTelemetry } from "pi-telemetry";

// ── Subset A — dev + full ────────────────────────────────────────────────

import taskPlan from "./task-plan/index.ts";
import memory from "./memory/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";
import codeQuality from "./code-quality/index.ts";
import fileIntelligence from "./file-intelligence/index.ts";
import subprocessOrchestrator from "./subprocess-orchestrator/index.ts";
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
			version: "1.0.0",
			description: "Unified task & plan management, memory, thinking-steps, code quality (8 formatters + 3 fixers), file intelligence, subprocess orchestration",
			tools: ["read", "edit", "write", "bash", "search", "copy_to_clipboard", "subprocess", "task"],
			events: ["session_start", "tool_call", "message_end", "session_shutdown"],
		});
	}

	// Subset A — dev + full
	taskPlan(pi);
	memory(pi);
	thinkingSteps(pi);
	codeQuality(pi);
	fileIntelligence(pi);
	registerClipboard(pi);
	subprocessOrchestrator(pi);

	// Subset B — full only
	if (profile === "full") {
		fileCollector(pi);
		astGrepTools(pi);
		codeReview(pi);
	}
}
