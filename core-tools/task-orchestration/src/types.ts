/**
 * Task Orchestration v2: Shared Type Definitions
 *
 * Unified type system for all task-related operations.
 * Supports blockedBy (explicit), topic (implicit), and sequenceOrder (explicit order).
 */

/**
 * Task status lifecycle: pending → in_progress → completed/failed
 * + deleted as tombstone (soft delete)
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  DELETED = 'deleted'
}

/**
 * Task intent: what action the task represents
 * Re-exported from shared intent types.
 */
export type { TaskIntent } from '../../intent/types';
export { INTENTS } from '../../intent/types';

/**
 * Task execution result
 */
export interface TaskResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Unified Task model
 *
 * Supports three dependency approaches:
 * 1. Explicit blockedBy (from todo)
 * 2. Implicit topic sequencing (from btw-task)
 * 3. Explicit sequenceOrder (from plan-tracker)
 *
 * Flexible enough to merge all three without breaking changes.
 */
export interface Task {
  // Identity
  id: string;
  text: string;

  // Status
  status: TaskStatus;
  intent?: TaskIntent;

  // Dependencies (multiple approaches supported)
  blockedBy?: string[];          // Explicit: task IDs that must complete first
  topic?: string;                // Implicit: auto-sequence tasks by topic
  sequenceOrder?: number;        // Explicit: manual ordering within topic

  // Execution
  executor?: 'sub-pi' | 'shell' | 'none';  // How to execute
  agent?: string;                // Which agent to use (if sub-pi)
  result?: TaskResult;           // Execution result

  // Source tracking (for migration/compat)
  source?: 'todo' | 'btw' | 'plan_tracker';

  // Metadata
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];

  // Timestamps
  createdAt: string;             // ISO 8601
  startedAt?: string;            // ISO 8601
  completedAt?: string;          // ISO 8601
}

/**
 * Event for audit trail / branch-replay
 */
export interface TaskEvent {
  type: 'created' | 'started' | 'completed' | 'failed' | 'updated' | 'deleted';
  taskId: string;
  task?: Task;
  timestamp: string;             // ISO 8601
  metadata?: Record<string, any>;
}

/**
 * Execution context from session
 */
export interface SessionContext {
  sessionId: string;
  messages: Message[];
  branch?: string;
  timestamp: string;
}

/**
 * Agent message (from conversation history)
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * Notifier interface (for dependency injection)
 */
export interface INotifier {
  update(tasks: Task[]): Promise<void>;
}

/**
 * Task Store interface (for dependency injection)
 */
export interface ITaskStore {
  save(task: Task): Promise<void>;
  load(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  getAll(): Promise<Task[]>;
  getPending(): Promise<Task[]>;
  getRunning(): Promise<Task[]>;
  delete(id: string): Promise<void>;
}

/**
 * Intent Classifier interface (for pluggable classifiers)
 * Re-exported from shared intent types.
 */
export type { IIntentClassifier } from '../../intent/types';

/**
 * Executor interface
 */
export interface ITaskExecutor {
  dispatch(dag: TaskDAG): Promise<void>;
  on(event: string, handler: Function): void;
  once(event: string, handler: Function): void;
}

/**
 * Extension API interface
 */
export interface ExtensionAPI {
  on(event: string, handler: Function): void;
  registerTool(name: string, config: any): void;
  exec(cmd: string, args?: string[]): Promise<{ exitCode: number; stdout?: string; stderr?: string }>;
  ui: {
    setNotification(id: string, component?: any): void;
    setWidget(id: string, component?: any): void;
  };
}

/**
 * Configuration for TaskExecutor
 */
export interface ExecutorOptions {
  maxRetries?: number;           // Default: 3
  timeout?: number;              // Default: 30000ms
  parallelLimit?: number;        // Default: 4
}
