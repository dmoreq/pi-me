/**
 * Tool Pairing Rule
 *
 * Ensures that toolCall (assistant) and toolResult (user) messages are never separated.
 * The LLM API requires that every tool result has a corresponding tool call
 * in the previous assistant message. Breaking this pairing causes 400 errors.
 *
 * Works with pi-ai normalized types across all providers (Claude, DeepSeek, OpenAI, etc.):
 * - Assistant messages: toolCall content blocks (type: "toolCall")
 * - Tool result messages: role: "toolResult" at message level
 *
 * Algorithm:
 * 1. Prepare: Extract tool call IDs and type flags from each message
 * 2. Process: Two passes:
 *    - First pass (forward): If toolCall is pruned, cascade prune to matching toolResult
 *    - Second pass (backward): If toolResult is kept, protect matching toolCall
 *
 * This rule MUST run AFTER all other pruning rules to protect tool pairs.
 */

import type { PruneRule, ProcessContext, MessageWithMetadata } from "../types";
import { extractToolUseIds, hasToolUse, hasToolResult } from "../metadata";

export const toolPairingRule: PruneRule = {
	name: "tool-pairing",
	description: "Preserve tool call/result pairing required by LLM APIs",

	/**
	 * Prepare phase: Extract tool call IDs and type flags from each message
	 * Uses pi-ai normalized types (toolCall blocks, toolResult role)
	 */
	prepare(msg, ctx) {
		msg.metadata.toolUseIds = extractToolUseIds(msg.message);
		msg.metadata.hasToolUse = hasToolUse(msg.message);
		msg.metadata.hasToolResult = hasToolResult(msg.message);
	},

	/**
	 * Process phase: Prevent breaking tool call/result pairs
	 */
	process(msg, ctx) {
		// PASS 1 (Forward): If toolCall is pruned, cascade prune to matching toolResult
		cascadePruneForward(msg, ctx);

		// PASS 2 (Backward): If toolResult is kept, protect matching toolCall
		protectToolUseBackward(msg, ctx);
	},
};

/**
 * Forward pass: If a toolCall is pruned, cascade prune its matching toolResult
 * Also: If a toolCall is kept, protect its matching toolResult
 */
function cascadePruneForward(msg: MessageWithMetadata, ctx: ProcessContext): void {
	if (!msg.metadata.hasToolUse) return;
	if (!msg.metadata.toolUseIds || msg.metadata.toolUseIds.length === 0) return;

	const toolUseIds = msg.metadata.toolUseIds;
	const isPruned = msg.metadata.shouldPrune;

	// Find next messages with matching toolResult
	for (let i = ctx.index + 1; i < ctx.messages.length; i++) {
		const nextMsg = ctx.messages[i];

		// Only consider messages with toolResult role
		if (!nextMsg.metadata.hasToolResult) continue;
		if (!nextMsg.metadata.toolUseIds) continue;

		// Check if this toolResult matches our toolCall
		const hasMatchingToolResult = toolUseIds.some((id) => nextMsg.metadata.toolUseIds?.includes(id));

		if (hasMatchingToolResult) {
			if (isPruned && !nextMsg.metadata.shouldPrune) {
				// toolCall is pruned, cascade to toolResult
				nextMsg.metadata.shouldPrune = true;
				nextMsg.metadata.pruneReason = "orphaned tool result (tool call was pruned)";

				if (ctx.config.debug) {
					getLogger().debug(
						`Tool-pairing: cascade pruning toolResult at index ${i} ` +
							`(toolCall at index ${ctx.index} was pruned)`,
					);
				}
			} else if (!isPruned && nextMsg.metadata.shouldPrune) {
				// toolCall is kept, protect toolResult
				nextMsg.metadata.shouldPrune = false;
				nextMsg.metadata.pruneReason = undefined;
				nextMsg.metadata.protectedByToolPairing = true;

				if (ctx.config.debug) {
					getLogger().debug(
						`Tool-pairing: protecting toolResult at index ${i} ` +
							`(toolCall at index ${ctx.index} is kept)`,
					);
				}
			}
		}
	}
}

/**
 * Backward pass: If a toolResult is kept, protect its matching toolCall
 */
function protectToolUseBackward(msg: MessageWithMetadata, ctx: ProcessContext): void {
	// Only process messages with toolResult role that are NOT marked for pruning
	if (!msg.metadata.hasToolResult || msg.metadata.shouldPrune) return;
	if (!msg.metadata.toolUseIds || msg.metadata.toolUseIds.length === 0) return;

	const toolUseIds = msg.metadata.toolUseIds;

	// Find previous messages with matching toolCall
	for (let i = ctx.index - 1; i >= 0; i--) {
		const prevMsg = ctx.messages[i];

		// Only consider messages with toolCall blocks
		if (!prevMsg.metadata.hasToolUse) continue;
		if (!prevMsg.metadata.toolUseIds) continue;

		// Check if this toolCall matches our kept toolResult
		const hasMatchingToolUse = toolUseIds.some((id) => prevMsg.metadata.toolUseIds?.includes(id));

		if (hasMatchingToolUse && prevMsg.metadata.shouldPrune) {
			// Protect the toolCall
			prevMsg.metadata.shouldPrune = false;
			prevMsg.metadata.pruneReason = undefined;
			prevMsg.metadata.protectedByToolPairing = true;

			if (ctx.config.debug) {
				getLogger().debug(
					`Tool-pairing: protecting toolCall at index ${i} ` +
						`(referenced by kept toolResult at index ${ctx.index})`,
				);
			}

			// Also protect the toolResult for this toolCall
			// (in case it was also marked for pruning by deduplication)
			protectMatchingToolResults(prevMsg, i, ctx);
		}
	}
}

/**
 * Helper: When a toolCall is protected, also protect its matching toolResults
 */
function protectMatchingToolResults(toolUseMsg: MessageWithMetadata, toolUseIndex: number, ctx: ProcessContext): void {
	if (!toolUseMsg.metadata.toolUseIds) return;

	const toolUseIds = toolUseMsg.metadata.toolUseIds;

	for (let i = toolUseIndex + 1; i < ctx.messages.length; i++) {
		const nextMsg = ctx.messages[i];

		if (!nextMsg.metadata.hasToolResult) continue;
		if (!nextMsg.metadata.toolUseIds) continue;

		const hasMatchingToolResult = toolUseIds.some((id) => nextMsg.metadata.toolUseIds?.includes(id));

		if (hasMatchingToolResult && nextMsg.metadata.shouldPrune) {
			nextMsg.metadata.shouldPrune = false;
			nextMsg.metadata.pruneReason = undefined;
			nextMsg.metadata.protectedByToolPairing = true;

			if (ctx.config.debug) {
				getLogger().debug(
					`Tool-pairing: protecting toolResult at index ${i} ` +
						`(paired with protected toolCall at index ${toolUseIndex})`,
				);
			}
		}
	}
}
