/**
 * Task Orchestration v2: TaskCard Component
 *
 * Renders individual task status with:
 * - Status icon
 * - Task text
 * - Elapsed time
 * - BlockedBy info
 * - Action buttons (skip, retry, prioritize)
 */

import { TaskRenderer } from './renderer';
import type { Task } from '../types';

export interface TaskCardOptions {
  task: Task;
  isDark?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export class TaskCard {
  private options: TaskCardOptions;

  constructor(options: TaskCardOptions) {
    this.options = options;
  }

  /**
   * Render the task card
   */
  render(): string {
    const { task, isDark, compact } = this.options;
    const icon = TaskRenderer.statusIcon(task);
    const color = TaskRenderer.statusColor(task, isDark);
    const duration = TaskRenderer.formatDuration(task);

    let output = `${color} ${icon} ${task.text}`;

    if (duration) {
      output += ` [${duration}]`;
    }

    if (!compact && task.blockedBy && task.blockedBy.length > 0) {
      output += `\n  ╰ blocked by: ${task.blockedBy.join(', ')}`;
    }

    if (!compact && task.priority === 'high') {
      output += ' 🔥';
    }

    if (!compact && task.priority === 'low') {
      output += ' 💤';
    }

    if (this.options.showActions) {
      output += '\n  [s] skip  [r] retry  [p] prioritize';
    }

    return output;
  }

  /**
   * Render minimal (compact) version
   */
  renderCompact(): string {
    this.options.showActions = false;

    const compact = Object.assign({}, this.options, { compact: true });
    const card = new TaskCard(compact);
    return card.render();
  }

  /**
   * Get task status summary line
   */
  static summaryLine(tasks: Task[]): string {
    const counts = TaskRenderer.countByStatus(tasks);
    const parts: string[] = [];

    if (counts.completed) parts.push(`${counts.completed}✓`);
    if (counts.in_progress) parts.push(`${counts.in_progress}→`);
    if (counts.pending) parts.push(`${counts.pending}⚫`);
    if (counts.failed) parts.push(`${counts.failed}✕`);
    if (counts.skipped) parts.push(`${counts.skipped}⊘`);

    return parts.join(' ');
  }
}
