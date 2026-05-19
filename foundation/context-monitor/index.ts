/**
 * Context Monitor — Extension registration.
 *
 * Part of the foundation umbrella.
 * Provides session stats tracking hooks: message counts, tool calls, file writes,
 * token usage updates, and unified stats via getContextMonitor() singleton.
 *
 * Activity triggers: fires badge notifications at meaningful thresholds —
 *   - context-depth: ≥50 messages (consider /handoff)
 *   - high-activity: >5 tool calls (consider /recap)
 *   - files-involved: >10 files touched
 *
 * v0.5.0: Merged from context-window + usage-extension.
 * v0.6.0: Inlined activity triggers (removed TelemetryAutomation indirection).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getContextMonitor } from "./context-monitor.ts";
import { recordEvent } from "pi-telemetry/helpers";

// Thresholds for activity-based notifications
const CONTEXT_DEPTH_THRESHOLD = 50;
const HIGH_ACTIVITY_THRESHOLD = 5;
const FILE_INVOLVEMENT_THRESHOLD = 10;

export default function (pi: ExtensionAPI) {
  const monitor = getContextMonitor();

  // Track which thresholds have already fired this session (avoid spam)
  let firedContextDepth = false;
  let firedHighActivity = false;
  let firedFilesInvolved = false;

  function resetFiredFlags() {
    firedContextDepth = false;
    firedHighActivity = false;
    firedFilesInvolved = false;
  }

  function checkTriggers(pi: ExtensionAPI) {
    const stats = monitor.getStats();

    if (!firedContextDepth && stats.messageCount >= CONTEXT_DEPTH_THRESHOLD) {
      firedContextDepth = true;
      const msg = `Context is deep (${stats.messageCount} messages). Consider /handoff to start fresh.`;
      try { (pi as any).notify?.(msg, { severity: "warning", badge: { text: "context-depth", variant: "warning" } }); } catch {}
      recordEvent("context-monitor", "context-depth", msg);
    }

    if (!firedHighActivity && stats.toolCallCount > HIGH_ACTIVITY_THRESHOLD) {
      firedHighActivity = true;
      const msg = `🔥 High activity (${stats.toolCallCount} tool calls). Consider checkpointing with /recap.`;
      try { (pi as any).notify?.(msg, { severity: "warning", badge: { text: "high-activity", variant: "warning" } }); } catch {}
      recordEvent("context-monitor", "high-activity", msg);
    }

    if (!firedFilesInvolved && stats.touchedFiles.length > FILE_INVOLVEMENT_THRESHOLD) {
      firedFilesInvolved = true;
      const msg = `📁 Many files involved (${stats.touchedFiles.length}). Ready for /handoff when you are.`;
      try { (pi as any).notify?.(msg, { severity: "info", badge: { text: "files-involved", variant: "info" } }); } catch {}
      recordEvent("context-monitor", "files-involved", msg);
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    monitor.reset(ctx.sessionId, ctx.cwd);
    resetFiredFlags();
  });

  pi.on("message_end", async (_event, _ctx) => {
    monitor.recordMessage();
    checkTriggers(pi);
  });

  pi.on("turn_end", async (_event, _ctx) => {
    monitor.recordTurn();
    checkTriggers(pi);
  });

  pi.on("tool_result", async (event, _ctx) => {
    monitor.recordToolCall(event.name || "unknown");
    if (event.name === "edit" || event.name === "write") {
      const content = event.content?.[0];
      if (content?.type === "text" && content.text) {
        const match = content.text.match(/(?:wrote|written to|edit|modified):\s*(\S+)/i);
        if (match) monitor.recordFileWrite(match[1]);
      }
    }
    checkTriggers(pi);
  });

  // Track token usage if available from session events
  pi.on("session_token_usage", (event) => {
    if (event?.usage) {
      monitor.updateTokenUsage({
        total: event.usage.totalTokens ?? 0,
        input: event.usage.inputTokens ?? 0,
        output: event.usage.outputTokens ?? 0,
        cacheRead: event.usage.cacheReadTokens ?? 0,
        cacheWrite: event.usage.cacheWriteTokens ?? 0,
        contextWindow: event.usage.contextWindow ?? 0,
      });
    }
  });
}
