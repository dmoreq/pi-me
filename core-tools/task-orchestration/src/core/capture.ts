import type { Task, TaskIntent, Message, IIntentClassifier } from '../types';
import { RegexIntentClassifier } from '../inference/intent';

export interface TaskCaptureResult {
  tasks: Task[];
  segments: string[];
  intents: TaskIntent[];
}

export class TaskCapture {
  private classifier: IIntentClassifier;

  constructor(classifier?: IIntentClassifier) {
    this.classifier = classifier || new RegexIntentClassifier();
  }

  infer(messages: Message[]): TaskCaptureResult {
    const segments: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'user' && msg.content) {
        const msgSegments = this.segmentMessage(msg.content);
        segments.push(...msgSegments);
      }
    }

    const tasks: Task[] = [];
    const intents: TaskIntent[] = [];
    const seen = new Set<string>();

    for (const segment of segments) {
      const text = this.extractText(segment);
      if (!text || text.length < 2) continue;
      if (seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());

      const intent = this.classifier.classify(segment);
      const now = new Date().toISOString();

      const task: Task = {
        id: `task-${Date.now()}-${tasks.length}`,
        text,
        status: 'pending' as Task['status'],
        intent,
        createdAt: now,
        priority: this.inferPriority(segment),
        tags: this.inferTags(segment),
        blockedBy: [],
      };

      if (tasks.length > 0) {
        const dep = this.inferImplicitDependency(segment, tasks);
        if (dep) task.blockedBy = [dep];
      }

      tasks.push(task);
      intents.push(intent);
    }

    return { tasks, segments, intents };
  }

  segmentMessage(message: string): string[] {
    if (!message || message.trim().length === 0) return [];
    let text = message.trim();

    if (text.includes(',')) {
      const parts = text.split(',').filter(Boolean).map(s => s.trim());
      if (parts.length > 1) return parts;
    }

    if (/\band\b/i.test(text)) {
      const parts = text.split(/\band\b/i).filter(Boolean).map(s => s.trim());
      if (parts.length > 1) return parts;
    }

    return [text];
  }

  extractText(segment: string): string {
    let text = segment.trim();
    text = text.replace(/\([^)]*\)/g, '').trim();
    text = text.replace(/^[-,.\s]*/, '').trim();
    text = text.replace(/[-,.\s]*$/, '').trim();
    text = text.replace(/['"]/g, '').trim();
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  private inferImplicitDependency(
    rawSegment: string,
    previousTasks: Task[]
  ): string | undefined {
    if (/(then|after|once|subsequently)\s+/i.test(rawSegment)) {
      if (previousTasks.length > 0) return previousTasks[previousTasks.length - 1].id;
    }
    return undefined;
  }

  private inferPriority(segment: string): 'low' | 'normal' | 'high' {
    if (/\b(urgent|critical|asap|important|blocker|immediately)\b/i.test(segment)) return 'high';
    if (/\b(nice\s+to\s+have|optional|eventually|someday|maybe)\b/i.test(segment)) return 'low';
    return 'normal';
  }

  private inferTags(segment: string): string[] {
    const tags: string[] = [];
    if (/api|endpoint|route/i.test(segment)) tags.push('api');
    if (/ui|ux|page|component|view/i.test(segment)) tags.push('ui');
    if (/db|database|sql|mongo|query/i.test(segment)) tags.push('database');
    if (/test|spec/i.test(segment)) tags.push('testing');
    if (/security|auth|auth|permission/i.test(segment)) tags.push('security');
    if (/doc|readme|guide|comment/i.test(segment)) tags.push('documentation');
    return [...new Set(tags)];
  }
}
