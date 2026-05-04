/**
 * Shared intent types across all extensions.
 * Single source of truth — task-orchestration, planning, and subprocess-orchestrator
 * all re-export from here.
 */

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

/**
 * Intent Classifier interface (for pluggable classifiers).
 *
 * The sync classify() is required for backward compatibility.
 * The async classifyAsync() is preferred — it enables AI-powered detection
 * with proper fallback handling. Callers that control the loop should
 * use classifyAsync() when available.
 */
export interface IIntentClassifier {
  /** Classify a free-text string into a TaskIntent (synchronous). */
  classify(text: string): TaskIntent;

  /**
   * Classify with source tracking — preferred over sync classify().
   * Returns both the intent and whether it came from AI or manual detection.
   * Falls back to manual if AI is unavailable or fails.
   * Default implementation delegates to sync classify().
   */
  classifyAsync?(text: string): Promise<{ intent: TaskIntent; source: 'ai' | 'manual' }>;
}
