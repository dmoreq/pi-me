/**
 * Unified Task Capture — extracts tasks from conversation and creates plans.
 *
 * Merges:
 * - task-orchestration/src/core/capture.ts (TaskCapture)
 * - task-orchestration/src/inference/* (AI + manual intent detection)
 *
 * Features:
 * - Automatic task capture from conversation (agent_end hook)
 * - AI-powered intent classification with manual fallback
 * - Implicit dependency inference (sequential "then" tasks)
 * - Priority and tag inference from text
 * - Plan creation from explicit user commands or LLM tool calls
 */

import type { Task, TaskIntent, Message } from "./types.ts";
import type { IIntentClassifier } from "./types.ts";
import { ManualIntentDetector } from "./intent-detector.ts";

export interface CaptureResult {
  tasks: Task[];
  sources: Array<"ai" | "manual">;
}

export class TaskCapture {
  private classifier: IIntentClassifier;
  private aiCount = 0;

  constructor(classifier?: IIntentClassifier) {
    this.classifier = classifier ?? new ManualIntentDetector();
  }

  get aiClassificationCount(): number {
    return this.aiCount;
  }

  /**
   * Extract tasks from conversation messages.
   * Prefers async AI-powered classification, falls back to sync manual.
   */
  async capture(messages: Message[]): Promise<CaptureResult> {
    const segments = this.segmentMessages(messages);
    if (segments.length === 0) return { tasks: [], sources: [] };

    const tasks: Task[] = [];
    const sources: Array<"ai" | "manual"> = [];
    const seen = new Set<string>();

    for (const segment of segments) {
      const text = this.cleanText(segment);
      if (!text || text.length < 2) continue;
      if (seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());

      let intent: TaskIntent;
      let source: "ai" | "manual" = "manual";

      if (this.classifier.classifyAsync) {
        try {
          const result = await this.classifier.classifyAsync(text);
          intent = result.intent;
          source = result.source;
          if (source === "ai") this.aiCount++;
        } catch {
          intent = this.classifier.classify(text);
        }
      } else {
        intent = this.classifier.classify(text);
      }

      sources.push(source);

      const now = new Date().toISOString();
      const task: Task = {
        id: `task-${Date.now()}-${tasks.length}`,
        text,
        status: "pending",
        intent,
        priority: this.inferPriority(text),
        tags: this.inferTags(text),
        blockedBy: [],
        source: "auto",
        createdAt: now,
        requiresReview: true, // Auto-captured tasks require review by default
      };

      // Implicit dependency on previous task if "then/after" language
      if (tasks.length > 0 && /(then|after|once|subsequently)\s+/i.test(text)) {
        task.blockedBy = [tasks[tasks.length - 1].id];
      }

      tasks.push(task);
    }

    return { tasks, sources };
  }

  /**
   * Segment messages into individual task descriptions.
   */
  private segmentMessages(messages: Message[]): string[] {
    const segments: string[] = [];
    for (const msg of messages) {
      if (msg.role === "user" && msg.content) {
        const msgSegments = this.segmentText(msg.content);
        segments.push(...msgSegments);
      }
    }
    return segments;
  }

  /**
   * Split a user message into potential task segments.
   */
  segmentText(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    const trimmed = text.trim();

    // Split by commas or "and" for multi-task messages
    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").filter(Boolean).map(s => s.trim());
      if (parts.length > 1) return parts;
    }
    if (/\band\b/i.test(trimmed)) {
      const parts = trimmed.split(/\band\b/i).filter(Boolean).map(s => s.trim());
      if (parts.length > 1) return parts;
    }

    return [trimmed];
  }

  /**
   * Clean text for classification.
   */
  cleanText(segment: string): string {
    return segment
      .replace(/\([^)]*\)/g, "")
      .replace(/^[-,.\s]*/, "")
      .replace(/[-,.\s]*$/, "")
      .replace(/['"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private inferPriority(text: string): "low" | "normal" | "high" {
    if (/\b(urgent|critical|asap|important|blocker|immediately)\b/i.test(text)) return "high";
    if (/\b(nice\s+to\s+have|optional|eventually|someday|maybe)\b/i.test(text)) return "low";
    return "normal";
  }

  private inferTags(text: string): string[] {
    const tags: string[] = [];
    if (/api|endpoint|route/i.test(text)) tags.push("api");
    if (/ui|ux|page|component|view/i.test(text)) tags.push("ui");
    if (/db|database|sql|mongo|query/i.test(text)) tags.push("database");
    if (/test|spec/i.test(text)) tags.push("testing");
    if (/security|auth|auth|permission/i.test(text)) tags.push("security");
    if (/doc|readme|guide|comment/i.test(text)) tags.push("documentation");
    return [...new Set(tags)];
  }
}

/**
 * Create a plan (multi-step task) from explicit data.
 */
export function createPlan(
  title: string,
  steps: string[],
  options?: {
    id?: string;
    status?: Task["status"];
    body?: string;
    assignedToSession?: string;
    requiresReview?: boolean;
  },
): Task {
  const now = new Date().toISOString();
  return {
    id: options?.id ?? `plan-${Date.now()}`,
    title,
    text: title,
    status: options?.status ?? "pending",
    priority: "normal",
    steps: steps.map((text, i) => ({ id: i + 1, text, done: false })),
    source: "manual",
    createdAt: now,
    assignedToSession: options?.assignedToSession,
    requiresReview: options?.requiresReview ?? true,
  };
}
