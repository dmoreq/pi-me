/**
 * Error Purging Rule
 *
 * Removes resolved errors from context.
 * If an error is followed by a successful retry of the same operation,
 * the error can be pruned as it's no longer relevant.
 */

import type { PruneRule } from "../../types.js";
import type { AgentMessage } from "@mariozechner/pi-coding-agent";

// ─── Helpers (inlined from old metadata.ts) ──────────────────────────

/** Check if message is an error. */
function isErrorMessage(message: AgentMessage): boolean {
  if (message.role === "toolResult") {
    return !!(message as any).isError;
  }
  if ("content" in message) {
    const content = typeof message.content === "string" ? message.content : "";
    return /error:|failed:|exception:|\[error\]/i.test(content);
  }
  return false;
}

/** Check if two messages represent the same operation (tool name + file path). */
function isSameOperation(msg1: AgentMessage, msg2: AgentMessage): boolean {
  if (msg1.role !== "toolResult" || msg2.role !== "toolResult") return false;
  const tool1 = (msg1 as any).toolName;
  const tool2 = (msg2 as any).toolName;
  if (tool1 !== tool2) return false;

  const path1 = extractFilePath(msg1);
  const path2 = extractFilePath(msg2);
  if (path1 && path2) return path1 === path2;

  return false;
}

function extractFilePath(message: AgentMessage): string | null {
  if (message.role !== "toolResult") return null;
  const toolName = (message as any).toolName;
  if (toolName !== "write" && toolName !== "edit") return null;
  const details = (message as any).details;
  if (details?.path) return details.path;
  if (details?.file) return details.file;
  return null;
}

// ─── Rule ────────────────────────────────────────────────────────────

export const errorPurgingRule: PruneRule = {
  name: "error-purging",
  description: "Remove resolved errors from context",

  prepare(msg, meta, ctx) {
    const isError = isErrorMessage(msg);
    meta.isError = isError;

    if (isError) {
      const laterSuccess = ctx.messages
        .slice(ctx.index + 1)
        .find((m) => isSameOperation(m, msg) && !isErrorMessage(m));

      meta.errorResolved = !!laterSuccess;
      if (ctx.config.debug && laterSuccess) {
        console.debug(`[pruning] ErrorPurging: found resolved error at index ${ctx.index}`);
      }
    }
  },

  process(msg, meta, ctx) {
    if (meta.shouldPrune) return;
    if (msg.role === "user") return;

    if (meta.isError && meta.errorResolved) {
      meta.shouldPrune = true;
      meta.pruneReason = "error resolved by later success";
      if (ctx.config.debug) console.debug(`[pruning] ErrorPurging: marking resolved error at index ${ctx.index}`);
    }
  },
};
