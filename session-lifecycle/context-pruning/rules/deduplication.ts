/**
 * Deduplication Rule
 *
 * Removes duplicate tool outputs based on content hash.
 * Messages with identical content are considered duplicates,
 * and only the first occurrence is kept.
 *
 * Uses a Set<string> for O(n) dedup instead of O(n²) slice+some scan.
 */

import type { PruneRule } from "../types";
import { hashMessage } from "../metadata";
import { getLogger } from "../logger";

// Track seen hashes across the process phase
// Reset on each workflow run (starts fresh for each LLM call)
const seenHashes = new Set<string>();

export const deduplicationRule: PruneRule = {
	name: "deduplication",
	description: "Remove duplicate tool outputs based on content hash",

	/**
	 * Prepare phase: Hash each message for comparison
	 */
	prepare(msg, ctx) {
		// Hash the message content
		msg.metadata.hash = hashMessage(msg.message);
	},

	/**
	 * Process phase: Mark duplicates for pruning
	 * Uses Set<string> for O(1) lookup instead of O(n) slice+some scan
	 */
	process(msg, ctx) {
		// Skip if already marked for pruning by another rule
		if (msg.metadata.shouldPrune) return;

		// Never prune user messages
		if (msg.message.role === "user") return;

		// Check if we've seen this exact content before
		const currentHash = msg.metadata.hash;
		if (!currentHash) return;

		// Set.has() is O(1) — much faster than slice().some() for large sessions
		if (seenHashes.has(currentHash)) {
			msg.metadata.shouldPrune = true;
			msg.metadata.pruneReason = "duplicate content";

			if (ctx.config.debug) {
				getLogger().debug(`Dedup: marking duplicate message at index ${ctx.index} (hash: ${currentHash})`);
			}
		} else {
			// First time seeing this hash — record it
			seenHashes.add(currentHash);
		}
	},
};

/**
 * Reset the seen hashes set (call between workflow runs for fresh state)
 */
export function resetSeenHashes(): void {
	seenHashes.clear();
}
