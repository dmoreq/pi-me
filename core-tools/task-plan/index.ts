/**
 * task-plan — Unified task & plan management entry point.
 *
 * Replaces: task-orchestration/, planning/, intent/
 */

export { TaskPlanExtension, default } from "./src/index.ts";
export { TaskStore } from "./src/store.ts";
export { TaskCapture } from "./src/capture.ts";
export { TaskExecutor } from "./src/executor.ts";
export { TaskDAG } from "./src/types.ts";
export type { Task, TaskStatus, TaskIntent, Step, Priority } from "./src/types.ts";
