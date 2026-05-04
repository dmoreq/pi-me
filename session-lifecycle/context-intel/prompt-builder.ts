/**
 * PromptBuilder — construct system and user prompts for LLM calls
 * Shared by handoff, auto-compact, and session-recap.
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

  /**
   * Build prompt for analyzing task dependencies.
   */
  static buildDependencyAnalysis(tasks: string[]): { system: string; user: string } {
    const system = `Analyze the list of tasks and identify dependencies.
Return a JSON object mapping task IDs to arrays of task IDs they depend on.
Example: { "t2": ["t1"], "t3": ["t1", "t2"] }`;

    const user = `Tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Analyze dependencies:`;

    return { system, user };
  }
}
