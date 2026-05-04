/**
 * Code Quality Extension
 *
 * Unified code quality pipeline: format → fix → analyze
 * Extends ExtensionLifecycle for automatic telemetry.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { CodeQualityPipeline } from "./pipeline.ts";
import { RunnerRegistry } from "./registry.ts";

export class CodeQualityExtension extends ExtensionLifecycle {
  readonly name = "code-quality";
  readonly version = "0.3.0";
  protected readonly description = "Code quality pipeline: format, fix, analyze";
  protected readonly tools = [];
  protected readonly events = ["edit", "write"];

  private pipeline: CodeQualityPipeline;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.pipeline = new CodeQualityPipeline();

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
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new CodeQualityExtension(pi);
  ext.register();
}
