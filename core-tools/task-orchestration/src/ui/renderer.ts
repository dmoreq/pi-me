/**
 * Task Orchestration v2: Shared UI Renderer
 *
 * Centralizes all task rendering logic:
 * - status icons
 * - status colors (theme-aware)
 * - duration formatting
 * - progress bars
 */

import type { Task } from '../types';

export interface Theme {
  success: string;
  warning: string;
  error: string;
  info: string;
  dim: string;
  accent: string;
  background: string;
  foreground: string;
}

const LIGHT_THEME: Theme = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  dim: '#9ca3af',
  accent: '#6366f1',
  background: '#ffffff',
  foreground: '#1f2937',
};

const DARK_THEME: Theme = {
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  dim: '#6b7280',
  accent: '#818cf8',
  background: '#1f2937',
  foreground: '#f9fafb',
};

export class TaskRenderer {
  /**
   * Get status icon
   */
  static statusIcon(task: Task): string {
    switch (task.status) {
      case 'completed': return '✓';
      case 'in_progress': return '→';
      case 'failed': return '✕';
      case 'skipped': return '⊘';
      case 'deleted': return '·';
      default: return '⚫';
    }
  }

  /**
   * Get status color for the given theme
   */
  static statusColor(task: Task, isDark: boolean = false): string {
    const theme = isDark ? DARK_THEME : LIGHT_THEME;
    switch (task.status) {
      case 'completed': return theme.success;
      case 'in_progress': return theme.warning;
      case 'failed': return theme.error;
      case 'skipped': return theme.dim;
      case 'deleted': return theme.dim;
      default: return theme.info;
    }
  }

  /**
   * Format duration from start time to now (or to completed)
   */
  static formatDuration(task: Task): string {
    const start = task.startedAt ? new Date(task.startedAt).getTime() : 0;
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    if (!start) return '';

    const diffMs = end - start;
    return this.formatMs(diffMs);
  }

  /**
   * Format milliseconds into human-readable string
   */
  static formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  }

  /**
   * Get theme object
   */
  static getTheme(isDark: boolean = false): Theme {
    return isDark ? DARK_THEME : LIGHT_THEME;
  }

  /**
   * Render a simple progress bar
   */
  static progressBar(current: number, total: number, width: number = 20): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, empty));
  }

  /**
   * Count tasks by status
   */
  static countByStatus(tasks: Task[]): Record<string, number> {
    const counts: Record<string, number> = {
      completed: 0,
      in_progress: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
    };
    for (const task of tasks) {
      counts[task.status] = (counts[task.status] || 0) + 1;
    }
    return counts;
  }
}
