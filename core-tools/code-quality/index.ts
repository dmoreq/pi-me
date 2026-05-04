/**
 * Code Quality Extension — Entry Point
 *
 * Auto-format (8 formatters) + Auto-fix (3 fixers) on every write/edit.
 * Consolidated from: autofix/ (now removed) + formatter-runners/ (now runners/formatter/)
 *
 * v1.0.0 — Consolidation release:
 * - Merged 3 modules (code-quality, autofix, formatter-runners) into 1
 * - Unified 8 formatters + 3 fixers with shared registry
 * - Added telemetry badges for format/fix success/failure
 * - Removed unused "analyze" stage
 * - Moved autofix from subset B to always-on (dev/full)
 */

export { CodeQualityExtension } from "./extension.ts";
export { default } from "./extension.ts";

// Re-export types for consumers
export type { ProcessResult, StageResult } from "./types.ts";
export type { RunnerRegistry } from "./registry.ts";
export { CodeQualityPipeline } from "./pipeline.ts";

// Re-export fix runners
export { biomeFix, eslintFix, ruffFix, type FixRunner, type FixResult } from "./runners/fix/index.ts";
