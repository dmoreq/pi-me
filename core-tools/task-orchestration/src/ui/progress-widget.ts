/**
 * Task Orchestration v2: Progress Widget
 *
 * Minimal footer bar showing task execution progress.
 * Updates automatically as tasks complete.
 */

import { TaskRenderer } from './renderer';
import { TaskCard } from './task-card';
import type { Task } from '../types';

export class ProgressWidget {
  private tasks: Task[];
  private onUpdate: ((summary: string) => void) | null;

  constructor() {
    this.tasks = [];
    this.onUpdate = null;
  }

  /**
   * Update with current task list
   */
  update(tasks: Task[]): void {
    this.tasks = tasks;
    if (this.onUpdate) {
      this.onUpdate(this.renderSummary());
    }
  }

  /**
   * Register update callback
   */
  onProgressUpdate(callback: (summary: string) => void): void {
    this.onUpdate = callback;
  }

  /**
   * Render summary string
   */
  renderSummary(): string {
    return TaskCard.summaryLine(this.tasks);
  }

  /**
   * Render full progress widget
   */
  renderFull(): string {
    const summary = this.renderSummary();
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.status === 'completed').length;

    if (total === 0) return 'No tasks';

    const bar = TaskRenderer.progressBar(done, total);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return `Tasks: ${pct}% ${bar} ${summary}`;
  }

  /**
   * Get completion percentage
   */
  getProgress(): { done: number; total: number; percent: number } {
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.status === 'completed').length;
    return {
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 100,
    };
  }

  /**
   * Check if all tasks completed
   */
  isComplete(): boolean {
    return this.tasks.length > 0 && this.tasks.every(
      t => t.status === 'completed' || t.status === 'skipped'
    );
  }
}
