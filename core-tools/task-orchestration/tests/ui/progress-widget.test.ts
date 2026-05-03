/**
 * Task Orchestration v2: Progress Widget Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProgressWidget } from '../../src/ui/progress-widget';
import { createTask } from '../../src/core/task';
import type { TaskStatus } from '../../src/types';

describe('ProgressWidget', () => {
  let widget: ProgressWidget;

  beforeEach(() => {
    widget = new ProgressWidget();
  });

  it('should render summary', () => {
    const tasks = [
      createTask({ id: '1', text: 'A', status: 'completed' as TaskStatus }),
      createTask({ id: '2', text: 'B', status: 'in_progress' as TaskStatus }),
      createTask({ id: '3', text: 'C', status: 'pending' as TaskStatus }),
    ];
    widget.update(tasks);
    const summary = widget.renderSummary();
    expect(summary).toContain('1✓');
    expect(summary).toContain('1→');
    expect(summary).toContain('1⚫');
  });

  it('should handle no tasks', () => {
    widget.update([]);
    expect(widget.renderFull()).toBe('No tasks');
  });

  it('should calculate progress', () => {
    const tasks = [
      createTask({ id: '1', text: 'A', status: 'completed' as TaskStatus }),
      createTask({ id: '2', text: 'B', status: 'completed' as TaskStatus }),
      createTask({ id: '3', text: 'C', status: 'pending' as TaskStatus }),
      createTask({ id: '4', text: 'D', status: 'pending' as TaskStatus }),
    ];
    widget.update(tasks);
    const progress = widget.getProgress();
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percent).toBe(50);
  });

  it('should detect completion when all done', () => {
    const tasks = [
      createTask({ id: '1', text: 'A', status: 'completed' as TaskStatus }),
      createTask({ id: '2', text: 'B', status: 'skipped' as TaskStatus }),
    ];
    widget.update(tasks);
    expect(widget.isComplete()).toBe(true);
  });

  it('should detect incomplete', () => {
    const tasks = [
      createTask({ id: '1', text: 'A', status: 'pending' as TaskStatus }),
    ];
    widget.update(tasks);
    expect(widget.isComplete()).toBe(false);
  });
});
