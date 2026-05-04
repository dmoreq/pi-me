/**
 * CodeQualityPipeline — Format → Fix → Notify workflow
 *
 * Simple 3-stage pipeline:
 * 1. Format (8 formatters: biome, prettier, eslint, ruff-format, clang-format, shfmt, cmake-format, markdownlint)
 * 2. Fix (3 fixers: biome --write, eslint --fix, ruff --fix)
 * 3. Notify (telemetry badges)
 *
 * Removed unused "analyze" stage.
 */

import { RunnerRegistry } from "./registry.ts";
import type { ProcessResult, RunnerConfig, RunnerResult, StageResult } from "./types.ts";

export class CodeQualityPipeline {
  private registry: RunnerRegistry;
  private config: { timeoutMs: number };

  constructor(
    registry?: RunnerRegistry,
    config: { timeoutMs?: number } = {}
  ) {
    this.registry = registry ?? new RunnerRegistry();
    this.config = { timeoutMs: config.timeoutMs ?? 30000 };
  }

  /**
   * Process a file through format → fix pipeline.
   */
  async processFile(
    filePath: string,
    cwd: string,
    exec: (cmd: string, args: string[], opts: any) => Promise<{ exitCode: number; stdout: string }>
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    const runnerConfig: RunnerConfig = { cwd, timeoutMs: this.config.timeoutMs, exec };

    // Stage 1: Format (8 formatters)
    const formatRunners = this.registry.getForFile(filePath, "format");
    const formatResults = await this.runAll(formatRunners, filePath, runnerConfig);
    const format = this.aggregateResults(formatResults);

    // Stage 2: Fix (3 fixers)
    const fixRunners = this.registry.getForFile(filePath, "fix");
    const fixResults = await this.runAll(fixRunners, filePath, runnerConfig);
    const fix = this.aggregateResults(fixResults);

    const duration = Date.now() - startTime;

    return {
      filePath,
      format,
      fix,
      duration,
    };
  }

  /**
   * Run all runners in parallel.
   */
  private async runAll(
    runners: any[],
    filePath: string,
    config: RunnerConfig
  ): Promise<RunnerResult[]> {
    const promises = runners.map(async (runner) => {
      try {
        return await runner.run(filePath, config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: "failed" as const, message };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Aggregate results: first success wins, otherwise first failure.
   */
  private aggregateResults(results: RunnerResult[]): StageResult {
    if (results.length === 0) {
      return { status: "skipped" };
    }

    // Return first success
    const success = results.find(r => r.status === "succeeded");
    if (success) {
      return {
        status: "succeeded",
        message: success.message,
        changes: success.changes,
      };
    }

    // Return first failure
    const failure = results.find(r => r.status === "failed");
    if (failure) {
      return {
        status: "failed",
        message: failure.message,
      };
    }

    // All skipped
    return { status: "skipped" };
  }

  /**
   * Get the registry (for adding runners).
   */
  getRegistry(): RunnerRegistry {
    return this.registry;
  }
}
