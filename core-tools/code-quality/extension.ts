/**
 * Code Quality Extension — Auto-Format + Auto-Fix with Telemetry
 *
 * Orchestrates the format → fix → notify pipeline.
 * Auto-executes on every write/edit tool call.
 *
 * Replaces: autofix/index.ts (separate auto-fix module)
 * Consolidates: 8 auto-formatters + 3 auto-fixers + telemetry
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { basename, dirname } from "node:path";
import { existsSync } from "node:fs";
import { CodeQualityPipeline } from "./pipeline.ts";
import { FIX_RUNNERS } from "./runners/fix/index.ts";
import { formatFile } from "./runners/formatter/dispatch.ts";
import { notifyCodeQuality } from "./telemetry/triggers.ts";
import type { ProcessResult } from "./types.ts";

export class CodeQualityExtension extends ExtensionLifecycle {
  readonly name = "code-quality";
  readonly version = "1.0.0"; // Consolidation release: formatters + fixers unified

  protected readonly description = "Unified code quality: auto-format (8 formatters) + auto-fix (3 fixers) with telemetry";
  protected readonly tools = [];
  protected readonly events = ["tool_call"];

  private pipeline: CodeQualityPipeline;
  private fileStats = { formatted: 0, fixed: 0, totalDuration: 0 };

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.pipeline = new CodeQualityPipeline();

    // Register fix runners with pipeline registry
    for (const runner of FIX_RUNNERS) {
      this.pipeline.getRegistry().register({
        id: runner.name,
        type: "fix",
        matches: (_filePath: string) => true,
        run: async (filePath: string, config: any) => {
          const available = runner.isAvailable(filePath, config.cwd);
          if (!available) return { status: "skipped" };

          const result = await runner.fix(filePath, config.timeoutMs);
          return {
            status: result.status,
            message: result.detail,
            changes: result.changes,
          };
        },
      });
    }
  }

  register(): void {
    super.register();
    // Expose memory store and other dependencies for tools
    (this.pi as any).__codeQualityStats = this.fileStats;
  }

  /**
   * On tool_call (write/edit), run the auto-format + auto-fix pipeline.
   */
  async onToolCall(event: any): Promise<void> {
    const toolName = event.toolName ?? "";
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath = event.input?.path;
    if (!filePath || !existsSync(filePath)) return;

    const cwd = dirname(filePath);

    try {
      const result = await this.pipeline.processFile(filePath, cwd, this.pi.exec);

      // Track stats
      this.fileStats.formatted += result.format.status === "succeeded" ? 1 : 0;
      this.fileStats.fixed += result.fix.status === "succeeded" ? 1 : 0;
      this.fileStats.totalDuration += result.duration;

      // Notify user
      this.notifyResults(result);

      // Track telemetry event
      this.track("code_quality_processed", {
        filePath,
        formatted: result.format.status === "succeeded",
        fixed: result.fix.status === "succeeded",
        duration: result.duration,
      });
    } catch (err: any) {
      this.track("code_quality_error", {
        filePath,
        error: err.message,
      });
    }
  }

  /**
   * Notify user via telemetry based on pipeline results.
   */
  private notifyResults(result: ProcessResult): void {
    const formatSuccess = result.format.status === "succeeded";
    const fixSuccess = result.fix.status === "succeeded";
    const formatFailed = result.format.status === "failed";
    const fixFailed = result.fix.status === "failed";

    if (formatSuccess && fixSuccess) {
      notifyCodeQuality({
        stage: "both",
        status: "success",
        detail: `formatted + fixed (${result.fix.changes ?? 0} issues)`,
        filePath: result.filePath,
        duration: result.duration,
      });
    } else if (formatSuccess) {
      notifyCodeQuality({
        stage: "format",
        status: "success",
        detail: result.format.message ?? "formatted",
        filePath: result.filePath,
        duration: result.duration,
      });
    } else if (fixSuccess) {
      notifyCodeQuality({
        stage: "fix",
        status: "success",
        detail: `fixed (${result.fix.changes ?? 0} issues)`,
        filePath: result.filePath,
        duration: result.duration,
      });
    }

    if (formatFailed) {
      notifyCodeQuality({
        stage: "format",
        status: "failure",
        detail: `format failed: ${result.format.message ?? "unknown error"}`,
        filePath: result.filePath,
        duration: result.duration,
      });
    }

    if (fixFailed) {
      notifyCodeQuality({
        stage: "fix",
        status: "failure",
        detail: `fix failed: ${result.fix.message ?? "unknown error"}`,
        filePath: result.filePath,
        duration: result.duration,
      });
    }
  }

  /**
   * Get formatted file count this session.
   */
  getFormattedCount(): number {
    return this.fileStats.formatted;
  }

  /**
   * Get fixed file count this session.
   */
  getFixedCount(): number {
    return this.fileStats.fixed;
  }

  /**
   * Get total processing time this session.
   */
  getTotalDuration(): number {
    return this.fileStats.totalDuration;
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new CodeQualityExtension(pi);
  ext.register();
}
