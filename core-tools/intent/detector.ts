/**
 * Intent detector helpers for task, command, and session classification.
 *
 * These lightweight manual detectors keep extension startup independent from
 * optional AI-backed classifiers.
 */

import type { CommandIntent, SessionIntent, TaskIntent } from "./types.ts";

export interface IntentDetectionResult<TIntent extends string> {
  intent: TIntent;
  source: "manual" | "ai";
}

class ManualTaskIntentDetector {
  classify(text: string): TaskIntent {
    const value = text.toLowerCase();
    if (/\b(fix|bug|error|fail|crash|debug|broken|issue)\b/.test(value)) return "fix";
    if (/\b(refactor|cleanup|simplify|restructure)\b/.test(value)) return "refactor";
    if (/\b(test|spec|coverage|assert)\b/.test(value)) return "test";
    if (/\b(doc|docs|readme|guide|comment)\b/.test(value)) return "docs";
    if (/\b(deploy|release|ship|publish|k8s|kubernetes)\b/.test(value)) return "deploy";
    if (/\b(analyze|review|inspect|audit|check)\b/.test(value)) return "analyze";
    if (/\b(implement|add|create|build|feature)\b/.test(value)) return "implement";
    return "general";
  }

  async classifyAsync(text: string): Promise<IntentDetectionResult<TaskIntent>> {
    return { intent: this.classify(text), source: "manual" };
  }
}

class ManualCommandIntentDetector {
  classify(text: string): CommandIntent {
    const value = text.toLowerCase();
    if (/\b(build|compile|bundle)\b/.test(value)) return "build";
    if (/\b(test|spec|coverage)\b/.test(value)) return "test";
    if (/\b(deploy|release|publish|ship)\b/.test(value)) return "deploy";
    if (/\b(lint|eslint|biome|ruff|format|prettier)\b/.test(value)) return "lint";
    if (/\b(install|npm i|pnpm i|yarn add|bun add)\b/.test(value)) return "install";
    if (/\b(analyze|inspect|audit|scan)\b/.test(value)) return "analyze";
    if (/\b(copy|move|delete|remove|mkdir|touch|file)\b/.test(value)) return "file_ops";
    if (/\b(serve|server|dev|start|watch)\b/.test(value)) return "serve";
    if (/\b(clean|cleanup|prune)\b/.test(value)) return "cleanup";
    return "general";
  }

  async classifyAsync(text: string): Promise<IntentDetectionResult<CommandIntent>> {
    return { intent: this.classify(text), source: "manual" };
  }
}

class ManualSessionIntentDetector {
  classify(text: string): IntentDetectionResult<SessionIntent> {
    const value = text.toLowerCase();
    if (/\b(fix|bug|error|fail|crash|debug|broken|issue)\b/.test(value)) return this.result("debug");
    if (/\b(feature|implement|add|create|build)\b/.test(value)) return this.result("feature");
    if (/\b(refactor|cleanup|simplify|restructure)\b/.test(value)) return this.result("refactor");
    if (/\b(explore|understand|find|where|how|analyze)\b/.test(value)) return this.result("explore");
    if (/\b(review|audit|inspect)\b/.test(value)) return this.result("review");
    if (/\b(test|spec|coverage)\b/.test(value)) return this.result("test");
    if (/\b(learn|explain|teach|what is)\b/.test(value)) return this.result("learn");
    if (/\b(deploy|release|ops|k8s|kubernetes|production)\b/.test(value)) return this.result("ops");
    return this.result("general");
  }

  async classifyAsync(text: string): Promise<IntentDetectionResult<SessionIntent>> {
    return this.classify(text);
  }

  private result(intent: SessionIntent): IntentDetectionResult<SessionIntent> {
    return { intent, source: "manual" };
  }
}

export function createTaskIntentDetector() {
  return { detector: new ManualTaskIntentDetector() };
}

export function createCommandIntentDetector() {
  return { detector: new ManualCommandIntentDetector() };
}

export function createSessionIntentDetector() {
  return { detector: new ManualSessionIntentDetector() };
}
