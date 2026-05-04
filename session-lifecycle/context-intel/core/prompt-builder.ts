/**
 * PromptBuilder — construct system and user prompts for LLM calls.
 *
 * Shared by handoff, auto-compact, auto-recap, and session-recap.
 * Ported from session-lifecycle/context-intel/prompt-builder.ts.
 * Removed: buildDependencyAnalysis (dead code).
 * Added: buildSessionRecap for auto-recap.
 */

export class PromptBuilder {
  /**
   * Build handoff prompt (context transfer to new session).
   */
  static buildHandoff(transcript: string, goal: string): { system: string; user: string } {
    const system = `You are a helpful assistant. Your job is to help the user start fresh in a new session.
The user is transitioning their work context to you. Review the conversation history below,
extract the key facts and open tasks, and help them get oriented.`;

    const user = `## Previous Context
${transcript}

## New Goal
${goal}

Please summarize what happened and what we should focus on next.`;

    return { system, user };
  }

  /**
   * Build session recap prompt (one-line summary of recent activity).
   */
  static buildRecap(transcript: string): { system: string; user: string } {
    const system = `You are a helpful assistant. Summarize the conversation in one short line.
Focus on the main outcome or open question.`;

    const user = `## Recent Conversation
${transcript}

Provide a one-line recap.`;

    return { system, user };
  }

  /**
   * Build auto-compact instructions (for context.compact()).
   */
  static buildCompactInstructions(customInstructions?: string): string {
    if (customInstructions) return customInstructions;
    return `Summarize the conversation so far in 2-3 sentences. Preserve facts, code, and open decisions.
Keep enough detail that a reader can understand the current state and next steps.`;
  }

  /**
   * Build session recap for auto-recap storage (slightly more detailed than buildRecap).
   */
  static buildSessionRecap(transcript: string): { system: string; user: string } {
    const system = `You are a helpful assistant. Summarize the key outcomes, decisions, and open items
from this conversation in 3-5 sentences. Focus on what was accomplished and what needs follow-up.`;

    const user = `## Conversation
${transcript}

Provide a concise session recap.`;

    return { system, user };
  }

  /**
   * Build prompt for extracting tasks from a conversation.
   */
  static buildTaskExtraction(transcript: string): { system: string; user: string } {
    const system = `Extract actionable tasks from the conversation.
Return a JSON array of objects with { id, text, intent, blockedBy }.
If no tasks found, return [].`;

    const user = `## Conversation
${transcript}

Extract tasks:`;

    return { system, user };
  }
}
