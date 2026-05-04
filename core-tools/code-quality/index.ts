/**
 * Code Quality Extension — Entry Point
 *
 * Auto-format (8 formatters) + Auto-fix (3 fixers) on every write/edit.
 */

export { CodeQualityExtension } from "./extension.ts";
export { default } from "./extension.ts";

// Re-export types for consumers
export type { ProcessResult, StageResult } from "./types.ts";
export type { RunnerRegistry } from "./registry.ts";
export { CodeQualityPipeline } from "./pipeline.ts";

// Re-export fix runners
export { biomeFix, eslintFix, ruffFix, type FixRunner, type FixResult } from "./runners/fix/index.ts";
