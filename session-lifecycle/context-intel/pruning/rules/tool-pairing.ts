/**
 * Tool Pairing Rule
 *
 * Ensures that toolCall (assistant) and toolResult messages are never separated.
 * The LLM API requires that every tool result has a corresponding tool call
 * in a previous assistant message. Breaking this pairing causes 400 errors.
 *
 * Algorithm:
 * 1. Prepare: Extract tool call IDs and type flags from each message
 * 2. Process: Two passes:
 *    - Forward: If toolCall is pruned, cascade prune to matching toolResult
 *    - Backward: If toolResult is kept, protect matching toolCall
 *
 * This rule MUST run AFTER all other pruning rules to protect tool pairs.
 */

import type { PruneRule, PruningMeta, ProcessContext } from "../../types.js";
import type { AgentMessage } from "@mariozechner/pi-coding-agent";

// ─── Helpers (inlined from old metadata.ts) ──────────────────────────

function extractToolUseIds(message: AgentMessage): string[] {
  const ids: string[] = [];
  if (message.role === "assistant" && "content" in message && Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part && typeof part === "object" && part.type === "toolCall" && part.id) {
        ids.push(part.id);
      }
    }
  }
  if (message.role === "toolResult") {
    const toolCallId = (message as any).toolCallId;
    if (toolCallId) ids.push(toolCallId);
  }
  return ids;
}

function hasToolUse(message: AgentMessage): boolean {
  if (message.role === "assistant" && "content" in message && Array.isArray(message.content)) {
    return message.content.some((part: any) => part && typeof part === "object" && part.type === "toolCall");
  }
  return false;
}

function hasToolResult(message: AgentMessage): boolean {
  return message.role === "toolResult";
}

// ─── Rule ────────────────────────────────────────────────────────────

export const toolPairingRule: PruneRule = {
  name: "tool-pairing",
  description: "Preserve tool call/result pairing required by LLM APIs",

  prepare(msg, meta) {
    meta.toolUseIds = extractToolUseIds(msg);
    meta.hasToolUse = hasToolUse(msg);
    meta.hasToolResult = hasToolResult(msg);
  },

  process(msg, meta, ctx) {
    cascadePruneForward(msg, meta, ctx);
    protectToolUseBackward(msg, meta, ctx);
  },
};

/** Forward pass: If a toolCall is pruned, cascade prune its matching toolResult. */
function cascadePruneForward(msg: AgentMessage, meta: PruningMeta, ctx: ProcessContext): void {
  if (!meta.hasToolUse) return;
  if (!meta.toolUseIds || meta.toolUseIds.length === 0) return;

  const toolUseIds = meta.toolUseIds;
  const isPruned = meta.shouldPrune;

  for (let i = ctx.index + 1; i < ctx.messages.length; i++) {
    const nextMeta = ctx.metas[i];
    if (!nextMeta.hasToolResult) continue;
    if (!nextMeta.toolUseIds) continue;

    const hasMatchingResult = toolUseIds.some((id) => nextMeta.toolUseIds?.includes(id));
    if (!hasMatchingResult) continue;

    if (isPruned && !nextMeta.shouldPrune) {
      nextMeta.shouldPrune = true;
      nextMeta.pruneReason = "orphaned tool result (tool call was pruned)";
      if (ctx.config.debug) console.debug(`[pruning] Tool-pairing: cascade pruning toolResult at ${i} (toolCall at ${ctx.index} was pruned)`);
    } else if (!isPruned && nextMeta.shouldPrune) {
      nextMeta.shouldPrune = false;
      nextMeta.pruneReason = undefined;
      nextMeta.protectedByToolPairing = true;
      if (ctx.config.debug) console.debug(`[pruning] Tool-pairing: protecting toolResult at ${i} (toolCall at ${ctx.index} is kept)`);
    }
  }
}

/** Backward pass: If a toolResult is kept, protect its matching toolCall. */
function protectToolUseBackward(_msg: AgentMessage, meta: PruningMeta, ctx: ProcessContext): void {
  if (!meta.hasToolResult || meta.shouldPrune) return;
  if (!meta.toolUseIds || meta.toolUseIds.length === 0) return;

  const toolUseIds = meta.toolUseIds;

  for (let i = ctx.index - 1; i >= 0; i--) {
    const prevMeta = ctx.metas[i];
    if (!prevMeta.hasToolUse) continue;
    if (!prevMeta.toolUseIds) continue;

    const hasMatchingUse = toolUseIds.some((id) => prevMeta.toolUseIds?.includes(id));
    if (!hasMatchingUse) continue;

    if (prevMeta.shouldPrune) {
      prevMeta.shouldPrune = false;
      prevMeta.pruneReason = undefined;
      prevMeta.protectedByToolPairing = true;
      if (ctx.config.debug) console.debug(`[pruning] Tool-pairing: protecting toolCall at ${i} (referenced by kept toolResult at ${ctx.index})`);

      // Also protect downstream toolResults for this toolCall
      protectMatchingResultsFor(prevMeta, i, ctx);
    }
  }
}

function protectMatchingResultsFor(meta: PruningMeta, metaIndex: number, ctx: ProcessContext): void {
  if (!meta.toolUseIds) return;
  const toolUseIds = meta.toolUseIds;

  for (let i = metaIndex + 1; i < ctx.messages.length; i++) {
    const nextMeta = ctx.metas[i];
    if (!nextMeta.hasToolResult) continue;
    if (!nextMeta.toolUseIds) continue;

    const hasMatching = toolUseIds.some((id) => nextMeta.toolUseIds?.includes(id));
    if (hasMatching && nextMeta.shouldPrune) {
      nextMeta.shouldPrune = false;
      nextMeta.pruneReason = undefined;
      nextMeta.protectedByToolPairing = true;
      if (ctx.config.debug) console.debug(`[pruning] Tool-pairing: protecting toolResult at ${i} (paired with protected toolCall at ${metaIndex})`);
    }
  }
}
