/**
 * RunnerRegistry — Open/Closed Principle for code runners
 * New formatters/fixers can be added without touching existing code.
 */

import type { CodeRunner } from "./types.ts";

export class RunnerRegistry {
  private runners = new Map<string, CodeRunner>();

  /**
   * Register a new runner. Duplicate IDs overwrite previous.
   */
  register(runner: CodeRunner): this {
    this.runners.set(runner.id, runner);
    return this;
  }

  /**
   * Get a runner by ID.
   */
  get(id: string): CodeRunner | undefined {
    return this.runners.get(id);
  }

  /**
   * Get all runners that match a file and type.
   */
  getForFile(filePath: string, type: "format" | "fix" | "analyze"): CodeRunner[] {
    return Array.from(this.runners.values()).filter(
      (r) => r.type === type && r.matches(filePath)
    );
  }

  /**
   * List all registered runners.
   */
  list(): CodeRunner[] {
    return Array.from(this.runners.values());
  }

  /**
   * Clear all runners.
   */
  clear(): void {
    this.runners.clear();
  }

  /**
   * Get count of registered runners.
   */
  size(): number {
    return this.runners.size;
  }
}
