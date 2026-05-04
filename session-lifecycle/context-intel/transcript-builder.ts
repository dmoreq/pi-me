/**
 * TranscriptBuilder — extract and format conversation transcripts
 * Used by handoff, auto-compact, and session-recap to build LLM-ready transcripts.
 */

import type { Message } from "@mariozechner/pi-coding-agent";

export interface TranscriptOptions {
  /** Include transcript from last user message only (for handoff). Default: false. */
  fromLastUser?: boolean;
  /** Maximum characters in output. Default: no limit. */
  maxChars?: number;
  /** Indent level for formatting. Default: 0. */
  indent?: number;
}

export class TranscriptBuilder {
  /**
   * Build a conversation transcript from messages.
   */
  static buildTranscript(messages: Message[], opts: TranscriptOptions = {}): string {
    const { fromLastUser = false, maxChars = Infinity, indent = 0 } = opts;

    // Find last user message if needed
    let startIdx = 0;
    if (fromLastUser) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          startIdx = i;
          break;
        }
      }
    }

    const lines: string[] = [];
    const ind = " ".repeat(indent);

    for (let i = startIdx; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === "user") {
        const text = this.extractText(msg.content);
        if (text) lines.push(`${ind}User: ${text}`);
      } else if (msg.role === "assistant") {
        const text = this.extractText(msg.content);
        if (text) lines.push(`${ind}Assistant: ${text}`);

        // Extract tool calls from content
        const toolCalls = this.extractToolCalls(msg.content);
        for (const [name, args] of toolCalls) {
          lines.push(`${ind}- ${name}(${JSON.stringify(args).slice(0, 100)}...)`);
        }
      }

      // Tool results (if included in content)
      if ("toolResult" in msg && msg.toolResult) {
        const result = msg.toolResult;
        const text = typeof result === "string" ? result : JSON.stringify(result).slice(0, 150);
        lines.push(`${ind}Result: ${text}`);
      }

      // Check if we've exceeded max chars
      const current = lines.join("\n");
      if (current.length > maxChars) {
        return current.slice(0, maxChars) + "\n... (truncated)";
      }
    }

    return lines.join("\n");
  }

  /**
   * Check if conversation has meaningful activity (not just user messages).
   */
  static hasMeaningfulActivity(messages: Message[]): boolean {
    if (messages.length === 0) return false;

    // Check for assistant tool calls
    for (const msg of messages) {
      if (msg.role === "assistant") {
        const toolCalls = this.extractToolCalls(msg.content);
        if (toolCalls.length > 0) return true;

        // Check for substantial assistant response
        const text = this.extractText(msg.content);
        if (text.split(/\s+/).length >= 30) return true;
      }
    }

    return false;
  }

  /**
   * Extract file paths mentioned in write/edit tool calls.
   */
  static extractFilePaths(messages: Message[]): string[] {
    const paths = new Set<string>();

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      const toolCalls = this.extractToolCalls(msg.content);
      for (const [name, args] of toolCalls) {
        if ((name === "write" || name === "edit") && typeof args.path === "string") {
          paths.add(args.path);
        }
      }
    }

    return Array.from(paths).sort();
  }

  /**
   * Count occurrences of a tool call by name.
   */
  static countToolCalls(messages: Message[], toolName: string): number {
    let count = 0;
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const toolCalls = this.extractToolCalls(msg.content);
      count += toolCalls.filter(([name]) => name === toolName).length;
    }
    return count;
  }

  /**
   * Extract plain text from message content (strips markdown if needed).
   */
  private static extractText(content: any): string {
    if (typeof content === "string") {
      return content.trim();
    }
    if (typeof content === "object" && content !== null) {
      if ("type" in content && content.type === "text" && "text" in content) {
        return content.text.trim();
      }
      return JSON.stringify(content).slice(0, 200);
    }
    return "";
  }

  /**
   * Extract tool calls from content (looks for toolUse blocks or tool_call structures).
   */
  private static extractToolCalls(content: any): Array<[string, any]> {
    const calls: Array<[string, any]> = [];

    if (typeof content !== "object") return calls;

    // Handle Anthropic toolUse blocks
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === "object") {
          if (block.type === "tool_use" && block.name && block.input) {
            calls.push([block.name, block.input]);
          }
        }
      }
    }

    // Handle single toolUse block
    if (content.type === "tool_use" && content.name && content.input) {
      calls.push([content.name, content.input]);
    }

    // Handle tool_call structure
    if (content.tool_call && typeof content.tool_call === "object") {
      const tc = content.tool_call;
      if (tc.name && tc.arguments) {
        calls.push([tc.name, tc.arguments]);
      }
    }

    return calls;
  }
}
