/**
 * TaskNormalizer — Adapt planning PlanSteps to SubprocessTasks
 * Bridge between planning extension and subprocess orchestration.
 */

import type { PlanStep } from "../planning/types.ts";
import type { SubprocessTask } from "./types.ts";

/**
 * Normalize a plan step into a subprocess task.
 * Maps step intent to shell commands and handles default arguments.
 */
export class TaskNormalizer {
  /**
   * Normalize a single plan step to subprocess task.
   */
  static normalize(step: PlanStep, cwd?: string): SubprocessTask {
    return {
      id: step.id,
      name: step.text,
      cmd: this.commandForIntent(step.intent),
      args: [step.text], // pass step text as first arg
      cwd: cwd ?? process.cwd(),
      critical: step.intent === "fix" || step.intent === "deploy",
      timeout: 30000, // 30s default
    };
  }

  /**
   * Normalize multiple steps to tasks.
   */
  static normalizeMany(steps: PlanStep[], cwd?: string): SubprocessTask[] {
    return steps.map(step => this.normalize(step, cwd));
  }

  /**
   * Map step intent to shell command.
   */
  private static commandForIntent(intent: string): string {
    switch (intent) {
      case "fix":
        return "bash"; // run bash script
      case "refactor":
        return "bash";
      case "test":
        return "npm";
      case "docs":
        return "bash";
      case "deploy":
        return "bash";
      case "analyze":
        return "bash";
      case "implement":
        return "bash";
      default:
        return "bash";
    }
  }

  /**
   * Get default args for intent type.
   */
  static defaultArgsForIntent(intent: string): string[] {
    switch (intent) {
      case "test":
        return ["test"];
      case "deploy":
        return ["-c"]; // bash -c script
      default:
        return ["-c"];
    }
  }

  /**
   * Check if step requires special handling.
   */
  static isSpecialCase(step: PlanStep): boolean {
    return step.intent === "deploy" || step.intent === "test";
  }
}
