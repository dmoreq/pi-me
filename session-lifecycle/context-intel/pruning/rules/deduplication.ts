/**
 * Deduplication Rule
 *
 * Removes duplicate tool outputs based on content hash.
 * Uses a Set for O(n) dedup instead of O(n²) slice+some scan.
 */

import type { PruneRule } from "../../types.js";
import type { AgentMessage } from "@mariozechner/pi-coding-agent";

// ─── Helpers (inlined from old metadata.ts) ──────────────────────────

/** Create a stable hash of message content for deduplication. */
function hashMessage(message: AgentMessage): string {
  let content = "";
  if ("content" in message) {
    if (message.content === null || message.content === undefined) {
      content = "";
    } else if (typeof message.content === "string") {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content
        .map((part: any) => {
          if (!part || typeof part !== "object") return "";
          if (part.type === "text") return part.text || "";
          if (part.type === "image") return `[image:${part.source?.type || "unknown"}]`;
          if (part.type === "toolCall") return `[tool:${part.name}:${JSON.stringify(part.arguments || {})}]`;
          return "";
        })
        .join("");
    }
  }
  if (message.role === "toolResult" && (message as any).isError) {
    content += "[error]";
  }
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return hash.toString(36);
}

// ─── Rule ────────────────────────────────────────────────────────────

const seenHashes = new Set<string>();

export const deduplicationRule: PruneRule = {
  name: "deduplication",
  description: "Remove duplicate tool outputs based on content hash",

  prepare(msg, meta) {
    meta.hash = hashMessage(msg);
  },

  process(msg, meta, ctx) {
    if (meta.shouldPrune) return;
    if (msg.role === "user") return;

    const currentHash = meta.hash;
    if (!currentHash) return;

    if (seenHashes.has(currentHash)) {
      meta.shouldPrune = true;
      meta.pruneReason = "duplicate content";
      if (ctx.config.debug) console.debug(`[pruning] Dedup: duplicate at index ${ctx.index} (hash: ${currentHash})`);
    } else {
      seenHashes.add(currentHash);
    }
  },
};

export function resetSeenHashes(): void {
  seenHashes.clear();
}
