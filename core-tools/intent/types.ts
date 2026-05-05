/**
 * Shared intent types across all extensions.
 *
 * Three classification domains:
 *   - TaskIntent (task-plan, code-review) — classify developer task descriptions
 *   - CommandIntent (subprocess-orchestrator) — classify shell commands
 *   - SessionIntent (welcome/session-lifecycle) — classify session goal
 */

// ═══════════════════════════════════════════════════════════════════════════
// Task Intents — developer task descriptions
// ═══════════════════════════════════════════════════════════════════════════

export const INTENTS = [
  "fix",        // Bug fixing, debugging, repairing
  "refactor",   // Code cleanup, optimization, rewriting
  "test",       // Testing, specs, integration tests
  "docs",       // Documentation, README, comments
  "deploy",     // Deployment, release, publish
  "analyze",    // Analysis, investigation, review (default)
  "implement",  // New feature implementation
  "general",    // General / unclassified
] as const;

export type TaskIntent = (typeof INTENTS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// Command Intents — shell command classification (subprocess-orchestrator)
// ═══════════════════════════════════════════════════════════════════════════

export const COMMAND_INTENTS = [
  "build",     // Compilation, bundling, transpilation
  "test",      // Running tests
  "deploy",    // Deployment, publishing
  "lint",      // Linting, formatting, static analysis
  "install",   // Package installation, dependency management
  "analyze",   // Profiling, debugging, diagnostics
  "file_ops",  // File operations, git, grep
  "serve",     // Dev servers, watchers
  "cleanup",   // Removing artifacts, pruning
  "general",   // Anything else
] as const;

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// Session Intents — overall session goal (welcome)
// ═══════════════════════════════════════════════════════════════════════════

export const SESSION_INTENTS = [
  "debug",     // Fixing bugs, troubleshooting
  "feature",   // Building new features
  "refactor",  // Improving code quality
  "explore",   // Exploring codebase, investigation
  "review",    // Code review, auditing
  "test",      // Writing/running tests
  "learn",     // Learning, asking questions
  "ops",       // Operations, deployment, CI/CD
  "general",   // Anything else
] as const;

export type SessionIntent = (typeof SESSION_INTENTS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// Intent Classifier interface (for pluggable classifiers)
// ═══════════════════════════════════════════════════════════════════════════

export interface IIntentClassifier {
  /** Classify a free-text string into a TaskIntent (synchronous). */
  classify(text: string): TaskIntent;

  /**
   * Classify with source tracking — preferred over sync classify().
   * Returns both the intent and whether it came from AI or manual detection.
   */
  classifyAsync?(text: string): Promise<{ intent: TaskIntent; source: 'ai' | 'manual' }>;
}
