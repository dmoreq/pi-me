/**
 * Task Orchestration v2: Executor Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskExecutor } from '../../src/core/executor';
import { TaskDAG, createTask } from '../../src/core/task';
import type { Task, TaskStatus, ExtensionAPI, ITaskStore } from '../../src/types';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let mockStore: ITaskStore;
  let mockPi: ExtensionAPI;

  beforeEach(() => {
    const savedTasks: Task[] = [];
    mockStore = {
      save: jest.fn().mockImplementation(async (task: Task) => {
        const idx = savedTasks.findIndex(t => t.id === task.id);
        if (idx >= 0) savedTasks[idx] = task;
        else savedTasks.push(task);
      }),
      load: jest.fn().mockResolvedValue(savedTasks),
      get: jest.fn().mockImplementation(async (id: string) => savedTasks.find(t => t.id === id)),
      getAll: jest.fn().mockResolvedValue(savedTasks),
      getPending: jest.fn().mockResolvedValue(savedTasks.filter(t => t.status === 'pending' as TaskStatus)),
      getRunning: jest.fn().mockResolvedValue(savedTasks.filter(t => t.status === 'in_progress' as TaskStatus)),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockPi = {
      on: jest.fn(),
      registerTool: jest.fn(),
      exec: jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'Done' }),
      ui: {
        setNotification: jest.fn(),
        setWidget: jest.fn(),
      },
    };

    executor = new TaskExecutor(mockStore, mockPi);
  });

  describe('dispatch', () => {
    it('should execute single task', async () => {
      const task = createTask({ id: 't1', text: 'Test task' });
      const dag = new TaskDAG([task]);

      await executor.dispatch(dag);

      expect(mockPi.exec).toHaveBeenCalled();
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('should execute sequential tasks in order', async () => {
      const tasks: Task[] = [
        createTask({ id: 't1', text: 'First', blockedBy: [] }),
        createTask({ id: 't2', text: 'Second', blockedBy: ['t1'] }),
      ];
      const dag = new TaskDAG(tasks);
      const execOrder: string[] = [];

      mockPi.exec = jest.fn().mockImplementation((_cmd: string, args: string[]) => {
        execOrder.push(args?.[0] || _cmd);
        return Promise.resolve({ exitCode: 0 });
      });

      await executor.dispatch(dag);

      expect(execOrder[0]).toContain('First');
      expect(execOrder[1]).toContain('Second');
    });

    it('should handle task failure', async () => {
      const task = createTask({ id: 't1', text: 'Failing task' });
      const dag = new TaskDAG([task]);

      mockPi.exec = jest.fn().mockResolvedValue({ exitCode: 1, stderr: 'Error' });

      await executor.dispatch(dag);

      const savedTask = (mockStore.save as jest.Mock).mock.calls;
      const lastCall = savedTask[savedTask.length - 1][0];
      expect(lastCall.status).toBe('failed');
    });

    it('should emit events', async () => {
      const task = createTask({ id: 't1', text: 'Test' });
      const dag = new TaskDAG([task]);
      const events: string[] = [];

      executor.on('task_started', () => events.push('started'));
      executor.on('task_completed', () => events.push('completed'));
      executor.on('all_completed', () => events.push('all_completed'));

      await executor.dispatch(dag);

      expect(events).toContain('started');
      expect(events).toContain('completed');
      expect(events).toContain('all_completed');
    });
  });

  describe('events', () => {
    it('should register and emit events', () => {
      const handler = jest.fn();

      executor.on('test_event', handler);
      // Access private emit via parent
      (executor as any).emit('test_event', 'data');

      expect(handler).toHaveBeenCalledWith('data');
    });

    it('should support once handlers', () => {
      const handler = jest.fn();

      executor.once('test_once', handler);
      (executor as any).emit('test_once', 'data');
      (executor as any).emit('test_once', 'data2');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('prioritize', () => {
    it('should prioritize a task', async () => {
      const task = createTask({ id: 't1', text: 'Test' });
      await mockStore.save(task);

      await executor.prioritize('t1');

      const saved = await mockStore.get('t1');
      expect(saved?.priority).toBe('high');
    });

    it('should throw for unknown task', async () => {
      await expect(executor.prioritize('unknown')).rejects.toThrow(/not found/);
    });
  });
});
