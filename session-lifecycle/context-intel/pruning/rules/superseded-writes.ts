/**
 * Superseded Writes Rule
 *
 * Removes older file write/edit operations when newer versions exist.
 * If the same file is written multiple times, only the latest write is kept.
 */

import type { PruneRule } from "../../types.js";
import type { AgentMessage } from "@mariozechner/pi-coding-agent";

// ─── Helpers (inlined from old metadata.ts) ──────────────────────────

/** Extract file path from write/edit tool result. */
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

export const supersededWritesRule: PruneRule = {
  name: "superseded-writes",
  description: "Remove older file writes when newer versions exist",

  prepare(msg, meta, ctx) {
    const filePath = extractFilePath(msg);
    if (filePath) {
      meta.filePath = filePath;
      if (ctx.config.debug) console.debug(`[pruning] SupersededWrites: found file operation at index ${ctx.index}: ${filePath}`);
    }
  },

  process(msg, meta, ctx) {
    if (meta.shouldPrune) return;
    if (!meta.filePath) return;
    if (msg.role === "user") return;

    const laterWrite = ctx.metas
      .slice(ctx.index + 1)
      .find((m) => m.filePath === meta.filePath);

    if (laterWrite) {
      meta.shouldPrune = true;
      meta.pruneReason = `superseded by later write to ${meta.filePath}`;
      if (ctx.config.debug) console.debug(`[pruning] SupersededWrites: marking superseded write at index ${ctx.index}: ${meta.filePath}`);
    }
  },
};
