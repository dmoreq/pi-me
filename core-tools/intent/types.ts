/**
 * Shared intent types across core-tools.
 */

export const INTENTS = [
  "fix",
  "refactor",
  "test",
  "docs",
  "deploy",
  "analyze",
  "implement",
  "general",
] as const;

export type TaskIntent = (typeof INTENTS)[number];

export const COMMAND_INTENTS = [
  "build",
  "test",
  "deploy",
  "lint",
  "install",
  "analyze",
  "file_ops",
  "serve",
  "cleanup",
  "general",
] as const;

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

export const SESSION_INTENTS = [
  "debug",
  "feature",
  "refactor",
  "explore",
  "review",
  "test",
  "learn",
  "ops",
  "general",
] as const;

export type SessionIntent = (typeof SESSION_INTENTS)[number];

export interface IIntentClassifier {
  classify(text: string): TaskIntent;
  classifyAsync?(text: string): Promise<{ intent: TaskIntent; source: "ai" | "manual" }>;
}
