/**
 * Context Monitor — Extension registration.
 *
 * Part of the foundation umbrella.
 * Provides session stats tracking hooks: message counts, tool calls, file writes,
 * token usage updates, and unified stats via getContextMonitor() singleton.
 *
 * v0.5.0: Merged from context-window + usage-extension.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getContextMonitor } from "./context-monitor.ts";

export default function (pi: ExtensionAPI) {
  const monitor = getContextMonitor();

  pi.on("session_start", async (_event, ctx) => {
    monitor.reset(ctx.sessionId, ctx.cwd);
  });

  pi.on("tool_result", async (event, _ctx) => {
    monitor.recordToolCall(event.name || "unknown");
    if (event.name === "edit" || event.name === "write") {
      // Track file writes from tool results
      const content = event.content?.[0];
      if (content?.type === "text" && content.text) {
        const match = content.text.match(/(?:wrote|written to|edit|modified):\s*(\S+)/i);
        if (match) monitor.recordFileWrite(match[1]);
      }
    }
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
