/**
 * Message metadata utilities
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { MessageWithMetadata } from "./types";

/**
 * Wrap an AgentMessage with metadata container
 */
export function createMessageWithMetadata(message: AgentMessage): MessageWithMetadata {
	return {
		message,
		metadata: {},
	};
}

/**
 * Create a stable hash of message content for deduplication
 *
 * Uses pi-ai normalized types:
 * - Assistant messages: toolCall blocks (type: "toolCall") with name + arguments
 * - Tool result messages: role: "toolResult" with text content and isError status
 * - Handles null content (DeepSeek tool-call-only messages)
 */
export function hashMessage(message: AgentMessage): string {
	// Create a stable string representation of the message content
	let content = "";

	if ("content" in message) {
		// Handle null/undefined content (DeepSeek assistant with tool calls only)
		if (message.content === null || message.content === undefined) {
			content = "";
		} else if (typeof message.content === "string") {
			content = message.content;
		} else if (Array.isArray(message.content)) {
			content = message.content
				.map((part: any) => {
					// Handle undefined or malformed parts
					if (!part || typeof part !== 'object') return "";

					if (part.type === "text") return part.text || "";
					if (part.type === "image") return `[image:${part.source?.type || "unknown"}]`;
					// pi-ai normalized type for tool calls
					if (part.type === "toolCall") return `[tool:${part.name}:${JSON.stringify(part.arguments || {})}]`;
					return "";
				})
				.join("");
		}
	}

	// Include isError status for tool result messages to distinguish error vs success
	if (message.role === "toolResult" && (message as any).isError) {
		content += "[error]";
	}

	// Simple hash function (djb2)
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = (hash * 33) ^ content.charCodeAt(i);
	}
	return hash.toString(36);
}

/**
 * Extract file path from write/edit tool result
 */
export function extractFilePath(message: AgentMessage): string | null {
	if (message.role !== "toolResult") return null;

	const toolName = (message as any).toolName;
	if (toolName !== "write" && toolName !== "edit") return null;

	// Try to extract from details
	const details = (message as any).details;
	if (details?.path) return details.path;
	if (details?.file) return details.file;

	return null;
}

/**
 * Check if message is an error
 */
export function isErrorMessage(message: AgentMessage): boolean {
	if (message.role === "toolResult") {
		return !!(message as any).isError;
	}

	// Check content for error patterns
	if ("content" in message) {
		const content = typeof message.content === "string" ? message.content : "";
		const errorPatterns = [/error:/i, /failed:/i, /exception:/i, /\[error\]/i];
		return errorPatterns.some((pattern) => pattern.test(content));
	}

	return false;
}

/**
 * Check if two messages represent the same operation (for error resolution tracking)
 */
export function isSameOperation(msg1: AgentMessage, msg2: AgentMessage): boolean {
	if (msg1.role !== "toolResult" || msg2.role !== "toolResult") return false;

	const tool1 = (msg1 as any).toolName;
	const tool2 = (msg2 as any).toolName;

	if (tool1 !== tool2) return false;

	// For file operations, check if same file
	const path1 = extractFilePath(msg1);
	const path2 = extractFilePath(msg2);

	if (path1 && path2) {
		return path1 === path2;
	}

	// For other operations, check if similar content
	// (this is a heuristic, could be improved)
	return hashMessage(msg1) === hashMessage(msg2);
}

/**
 * Extract tool call IDs from a message
 *
 * Handles pi-ai normalized types:
 * - Assistant messages: toolCall blocks with id field
 * - Tool result messages: role: "toolResult" with toolCallId field
 */
export function extractToolUseIds(message: AgentMessage): string[] {
	const ids: string[] = [];

	// Assistant messages: extract toolCall IDs from content blocks
	if (message.role === "assistant" && "content" in message && Array.isArray(message.content)) {
		for (const part of message.content) {
			if (part && typeof part === 'object' && part.type === "toolCall" && part.id) {
				ids.push(part.id);
			}
		}
	}

	// Tool result messages: extract toolCallId from message-level field
	if (message.role === "toolResult") {
		const toolCallId = (message as any).toolCallId;
		if (toolCallId) {
			ids.push(toolCallId);
		}
	}

	return ids;
}

/**
 * Check if a message contains toolCall blocks (pi-ai normalized type)
 */
export function hasToolUse(message: AgentMessage): boolean {
	// Tool calls live in assistant message content as "toolCall" blocks
	if (message.role === "assistant" && "content" in message && Array.isArray(message.content)) {
		return message.content.some((part: any) =>
			part && typeof part === 'object' && part.type === "toolCall"
		);
	}
	return false;
}

/**
 * Check if a message is a toolResult (pi-ai message-level role, not a content block)
 */
export function hasToolResult(message: AgentMessage): boolean {
	return message.role === "toolResult";
}
