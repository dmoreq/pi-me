/**
 * Task Orchestration v2: Renderer Tests
 */

import { describe, it, expect } from '@jest/globals';
import { TaskRenderer } from '../../src/ui/renderer';
import { createTask } from '../../src/core/task';
import type { TaskStatus } from '../../src/types';

describe('TaskRenderer', () => {
  describe('statusIcon', () => {
    it('should return correct icon for each status', () => {
      expect(TaskRenderer.statusIcon(createTask({ status: 'pending' as TaskStatus }))).toBe('⚫');
      expect(TaskRenderer.statusIcon(createTask({ status: 'in_progress' as TaskStatus }))).toBe('→');
      expect(TaskRenderer.statusIcon(createTask({ status: 'completed' as TaskStatus }))).toBe('✓');
      expect(TaskRenderer.statusIcon(createTask({ status: 'failed' as TaskStatus }))).toBe('✕');
      expect(TaskRenderer.statusIcon(createTask({ status: 'skipped' as TaskStatus }))).toBe('⊘');
    });
  });

  describe('formatMs', () => {
    it('should format milliseconds', () => {
      expect(TaskRenderer.formatMs(500)).toBe('500ms');
      expect(TaskRenderer.formatMs(2000)).toBe('2s');
      expect(TaskRenderer.formatMs(90000)).toBe('1m 30s');
    });
  });

  describe('progressBar', () => {
    it('should render progress bar', () => {
      const bar = TaskRenderer.progressBar(5, 10, 20);
      expect(bar.length).toBe(20);
      expect(bar).toContain('█');
      expect(bar).toContain('░');
    });

    it('should render full bar', () => {
      const bar = TaskRenderer.progressBar(10, 10, 20);
      expect(bar).toBe('█'.repeat(20));
    });

    it('should render empty bar', () => {
      const bar = TaskRenderer.progressBar(0, 10, 20);
      expect(bar).toBe('░'.repeat(20));
    });
  });

  describe('countByStatus', () => {
    it('should count tasks by status', () => {
      const tasks = [
        createTask({ status: 'completed' as TaskStatus }),
        createTask({ status: 'completed' as TaskStatus }),
        createTask({ status: 'pending' as TaskStatus }),
        createTask({ status: 'in_progress' as TaskStatus }),
      ];
      const counts = TaskRenderer.countByStatus(tasks);
      expect(counts.completed).toBe(2);
      expect(counts.pending).toBe(1);
      expect(counts.in_progress).toBe(1);
      expect(counts.failed).toBe(0);
    });
  });
});
