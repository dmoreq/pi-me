/**
 * Task Orchestration v2: task_control Tool Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createExtension } from '../../src/index';
import { TaskStore } from '../../src/persistence/state';
import { createTask } from '../../src/core/task';
import type { ExtensionAPI, TaskStatus } from '../../src/types';

describe('task_control Tool', () => {
  let mockPi: ExtensionAPI;
  let tools: Record<string, any>;
  let store: TaskStore;

  beforeEach(() => {
    tools = {};
    store = new TaskStore();
    mockPi = {
      on: jest.fn(),
      registerTool: jest.fn((name: string, config: any) => {
        tools[name] = config;
      }),
      exec: jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'Done' }),
      ui: {
        setNotification: jest.fn(),
        setWidget: jest.fn(),
      },
    };
  });

  it('should skip a task', async () => {
    createExtension(mockPi, { store });
    const task = createTask({ id: 't1', text: 'Test task' });
    await store.save(task);

    const result = await tools.task_control.execute(null, {
      taskId: 't1',
      action: 'skip',
    });

    expect(result).toEqual({ ok: true, status: 'skipped' });

    const saved = await store.get('t1');
    expect(saved?.status).toBe('skipped');
  });

  it('should return error for unknown task', async () => {
    createExtension(mockPi, { store });

    const result = await tools.task_control.execute(null, {
      taskId: 'unknown',
      action: 'skip',
    });

    expect(result.error).toContain('not found');
  });

  it('should retry a task', async () => {
    createExtension(mockPi, { store });
    const task = createTask({
      id: 't1',
      text: 'Test task',
      status: 'failed' as TaskStatus,
      result: { error: 'Previous failure' },
    });
    await store.save(task);

    const result = await tools.task_control.execute(null, {
      taskId: 't1',
      action: 'retry',
    });

    expect(result).toEqual({ ok: true, status: 'retried' });

    const saved = await store.get('t1');
    expect(saved?.status).toBe('pending');
    expect(saved?.result).toBeUndefined();
  });

  it('should prioritize a task', async () => {
    createExtension(mockPi, { store });
    const task = createTask({ id: 't1', text: 'Test task' });
    await store.save(task);

    const result = await tools.task_control.execute(null, {
      taskId: 't1',
      action: 'prioritize',
    });

    expect(result).toEqual({ ok: true, status: 'prioritized' });

    const saved = await store.get('t1');
    expect(saved?.priority).toBe('high');
  });
});
