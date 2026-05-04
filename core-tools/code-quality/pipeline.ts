/**
 * CodeQualityPipeline — format → fix → analyze workflow
 */

import { RunnerRegistry } from "./registry.ts";
import type { PipelineResult, RunnerConfig, RunnerResult } from "./types.ts";

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
   * Process a file through format → fix → analyze pipeline.
   */
  async processFile(
    filePath: string,
    cwd: string,
    exec: (cmd: string, args: string[], opts: any) => Promise<{ exitCode: number; stdout: string }>
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const runnerConfig: RunnerConfig = { cwd, timeoutMs: this.config.timeoutMs, exec };

    // Step 1: Format
    const formatRunners = this.registry.getForFile(filePath, "format");
    const formatResults = await this.runAll(formatRunners, filePath, runnerConfig);

    // Step 2: Fix (only if format succeeded or there were no format runners)
    const fixRunners = this.registry.getForFile(filePath, "fix");
    const fixResults = await this.runAll(fixRunners, filePath, runnerConfig);

    // Step 3: Analyze
    const analyzeRunners = this.registry.getForFile(filePath, "analyze");
    const analyzeResults = await this.runAll(analyzeRunners, filePath, runnerConfig);

    const duration = Date.now() - startTime;

    return {
      filePath,
      format: formatResults,
      fix: fixResults,
      analyze: analyzeResults,
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
   * Get the registry (for adding runners).
   */
  getRegistry(): RunnerRegistry {
    return this.registry;
  }
}
