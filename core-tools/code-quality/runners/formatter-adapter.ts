/**
 * Formatter Adapter — bridges core-tools/formatter runners into code-quality pipeline.
 *
 * Each formatter runner (prettier, eslint, biome, etc.) becomes a "format" type
 * CodeRunner in the code-quality RunnerRegistry.
 *
 * This avoids having to rewrite the formatter dispatch system entirely while
 * still making the pipeline work as format → fix → analyze.
 */

import type { CodeRunner, RunnerConfig, RunnerResult } from "../types.ts";
import { formatFile } from "../../formatter/extensions/formatter/dispatch.ts";

/**
 * Create a CodeRunner that delegates to the formatter system.
 * Since the formatter handles its own file-type detection and runner
 * selection, this adapter simply calls formatFile() for any path.
 *
 * Type parameter controls which stage in the pipeline this sits:
 * - "format": actual formatting (formatters that rewrite files)
 */
function createFormatterRunner(type: "format" = "format"): CodeRunner {
  return {
    id: `formatter-adapter`,
    type,
    matches(_filePath: string): boolean {
      // The formatter dispatch internally checks if it can handle the file.
      // We return true here and let formatFile decide.
      return true;
    },
    async run(filePath: string, config: RunnerConfig): Promise<RunnerResult> {
      try {
        // Delegate to the formatter dispatch system
        await formatFile(
          null as any, // pi is not needed for the formatter call
          config.cwd,
          filePath,
          config.timeoutMs,
        );
        return { status: "succeeded" };
      } catch (err: any) {
        return {
          status: "failed",
          message: err.message ?? String(err),
        };
      }
    },
  };
}

/**
 * Pre-built format adapter that can be registered with code-quality.
 */
export const formatAdapter = createFormatterRunner("format");
