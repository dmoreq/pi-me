/**
 * code-quality — barrel export
 */

export { CodeQualityExtension, default } from "./code-quality/index.ts";
export { CodeQualityPipeline } from "./code-quality/pipeline.ts";
export { RunnerRegistry } from "./code-quality/registry.ts";
export type { CodeRunner, RunnerConfig, RunnerResult, PipelineResult, Snippet } from "./code-quality/types.ts";
