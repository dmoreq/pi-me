/**
 * subprocess-orchestrator — barrel export
 */

export { SubprocessOrchestrationExtension, default } from "./subprocess-orchestrator/index.ts";
export { SubprocessExecutor } from "./subprocess-orchestrator/executor.ts";
export { TaskNormalizer } from "./subprocess-orchestrator/normalizer.ts";
export type { SubprocessTask, SubprocessResult, SubprocessConfig } from "./subprocess-orchestrator/types.ts";
