/**
 * Code Quality Extension
 *
 * Unified code quality pipeline: format → fix → analyze
 * Merged with core-tools/formatter runners in Phase 5.
 *
 * Extends ExtensionLifecycle for automatic telemetry.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { CodeQualityPipeline } from "./pipeline.ts";
import { RunnerRegistry } from "./registry.ts";
import { formatAdapter } from "./runners/formatter-adapter.ts";

export class CodeQualityExtension extends ExtensionLifecycle {
  readonly name = "code-quality";
  readonly version = "0.5.0";
  protected readonly description = "Code quality pipeline: format, fix, analyze (merged with formatter)";
  protected readonly tools = [];
  protected readonly events = ["edit", "write"];

  private pipeline: CodeQualityPipeline;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.pipeline = new CodeQualityPipeline();

    // Register the formatter adapter as a format runner
    this.pipeline.getRegistry().register(formatAdapter);

    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });
  }

  /**
   * Get the runner registry for registering custom runners.
   */
  getRegistry(): RunnerRegistry {
    return this.pipeline.getRegistry();
  }

  /**
   * Get the pipeline for processing files.
   */
  getPipeline(): CodeQualityPipeline {
    return this.pipeline;
  }

  /**
   * Process a file through the quality pipeline and fire automation triggers.
   */
  async processFileWithTelemetry(filePath: string, cwd: string, exec: any): Promise<any> {
    // Fire telemetry for format stage
    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
    const formatTrigger = TelemetryAutomation.qualityCheckRan(filePath, "format");
    TelemetryAutomation.fire(this, formatTrigger);

    const result = await this.pipeline.processFile(filePath, cwd, exec);

    // Fire telemetry for completion
    const completeTrigger = TelemetryAutomation.qualityCheckRan(filePath, "complete");
    TelemetryAutomation.fire(this, completeTrigger);

    this.track("file_processed", { filePath, duration: result.duration });
    return result;
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new CodeQualityExtension(pi);
  ext.register();
}
