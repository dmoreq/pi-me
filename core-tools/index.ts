/**
 * core-tools — Umbrella entry point.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.ts";
import { getTelemetry } from "pi-telemetry";

import smartCommit from "./smart-commit/index.ts";
import workflow from "./workflow/index.ts";
import { registerClipboard } from "./clipboard.ts";

import fileCollector from "./file-collector/index.ts";
import codeReview from "./code-review/index.ts";

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  if (profile === "minimal") return;

  const t = getTelemetry();
  if (t) {
    t.register({
      name: "core-tools",
      version: "1.0.0",
      description: "Unified task & plan management, memory, thinking-steps, code quality, workflow orchestration",
      tools: ["read", "edit", "write", "bash", "search", "copy_to_clipboard", "subprocess", "task", "workflow", "commit_message"],
      events: ["session_start", "tool_call", "message_end", "session_shutdown"],
    });
  }

  smartCommit(pi);
  workflow(pi);
  registerClipboard(pi);

  if (profile === "full") {
    fileCollector(pi);
    codeReview(pi);
  }
}
