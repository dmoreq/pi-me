/**
 * Task Orchestration v2: Notification Inbox
 *
 * Smart notification filtering:
 * - Show errors immediately (FAILED)
 * - Show long-running tasks (>10s)
 * - Show recent completions (flash 5s)
 * - Hide: pending, queued, short-running
 * - Auto-dismiss: completions after 5s
 * - Persist: errors until dismissed
 */

import type { Task, INotifier } from '../types';

export interface Notification {
  type: 'error' | 'completion' | 'progress';
  taskId: string;
  text: string;
  color: string;
  icon: string;
  timestamp: number;
  dismissed?: boolean;
}

export class NotificationInbox implements INotifier {
  private notifications: Map<string, Notification>;
  private onUpdate: ((notifications: Notification[]) => void) | null;
  private flashDuration: number;
  private longRunningThreshold: number;

  constructor(
    flashDuration: number = 5000,
    longRunningThreshold: number = 10000
  ) {
    this.notifications = new Map();
    this.onUpdate = null;
    this.flashDuration = flashDuration;
    this.longRunningThreshold = longRunningThreshold;
  }

  /**
   * Update tasks and generate notifications
   */
  async update(tasks: Task[]): Promise<void> {
    const now = Date.now();

    for (const task of tasks) {
      const existing = this.notifications.get(task.id);

      // Errors: show immediately, persist until dismissed
      if (task.status === 'failed') {
        this.notifications.set(task.id, {
          type: 'error',
          taskId: task.id,
          text: task.text,
          color: '#ef4444',
          icon: '✕',
          timestamp: now,
        });
        continue;
      }

      // Completions: flash for 5s
      if (task.status === 'completed') {
        if (!existing || existing.type === 'progress') {
          this.notifications.set(task.id, {
            type: 'completion',
            taskId: task.id,
            text: task.text,
            color: '#22c55e',
            icon: '✓',
            timestamp: now,
          });
        }
        continue;
      }

      // Long-running: show if > 10s
      if (task.status === 'in_progress' && task.startedAt) {
        const elapsed = now - new Date(task.startedAt).getTime();
        if (elapsed > this.longRunningThreshold) {
          this.notifications.set(task.id, {
            type: 'progress',
            taskId: task.id,
            text: task.text,
            color: '#f59e0b',
            icon: '→',
            timestamp: now,
          });
          continue;
        }

        // Remove running notification if still short
        if (existing && existing.type === 'progress') {
          this.notifications.delete(task.id);
        }
      }

      // Hide: pending, skipped, deleted (remove if existed)
      if (
        task.status === 'pending' ||
        task.status === 'skipped' ||
        task.status === 'deleted'
      ) {
        this.notifications.delete(task.id);
      }
    }

    // Clean up expired completions
    for (const [id, notif] of this.notifications) {
      if (notif.type === 'completion' && now - notif.timestamp > this.flashDuration) {
        this.notifications.delete(id);
      }
    }

    // Notify listeners
    if (this.onUpdate) {
      this.onUpdate(this.getActive());
    }
  }

  /**
   * Register update callback
   */
  onNotificationsUpdate(callback: (notifications: Notification[]) => void): void {
    this.onUpdate = callback;
  }

  /**
   * Get active (non-dismissed) notifications
   */
  getActive(): Notification[] {
    const now = Date.now();
    return Array.from(this.notifications.values())
      .filter(n => !n.dismissed)
      .filter(n => {
        // Completions expire after flashDuration
        if (n.type === 'completion') {
          return now - n.timestamp <= this.flashDuration;
        }
        return true;
      })
      .sort((a, b) => {
        // Errors first, then running, then completions
        const order = { error: 0, progress: 1, completion: 2 };
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
      });
  }

  /**
   * Dismiss a notification
   */
  dismiss(taskId: string): void {
    const notif = this.notifications.get(taskId);
    if (notif) {
      notif.dismissed = true;
    }
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notifications.clear();
  }

  /**
   * Get notification count
   */
  getCount(): number {
    return this.getActive().length;
  }

  /**
   * Check if there are any notifications
   */
  hasNotifications(): boolean {
    return this.getCount() > 0;
  }
}
