/**
 * Task Orchestration v2: State Management Tests
 *
 * Tests for:
 * - TaskStore (save, load, query)
 * - EventLog (append, reconstruct)
 * - StateManager (combined)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskStore, EventLog, StateManager } from '../../src/persistence/state';
import { createTask } from '../../src/core/task';
import type { TaskStatus } from '../../src/types';

describe('TaskStore', () => {
  let tempDir: string;
  let storeFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-store-'));
    storeFile = path.join(tempDir, 'tasks.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('save/load', () => {
    it('should save and load task', async () => {
      const store = new TaskStore(storeFile);
      const task = createTask({ id: 'task-1', text: 'Test task' });

      await store.save(task);
      const loaded = await store.get('task-1');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('task-1');
      expect(loaded?.text).toBe('Test task');
    });

    it('should persist to file', async () => {
      const store = new TaskStore(storeFile);
      const task = createTask({ id: 'task-1', text: 'Test' });

      await store.save(task);
      expect(fs.existsSync(storeFile)).toBe(true);

      const content = fs.readFileSync(storeFile, 'utf-8');
      const json = JSON.parse(content);
      expect(json[0].id).toBe('task-1');
    });

    it('should load from existing file', async () => {
      const task = createTask({ id: 'task-1', text: 'Test' });
      fs.writeFileSync(storeFile, JSON.stringify([task]));

      const store = new TaskStore(storeFile);
      const loaded = await store.get('task-1');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('task-1');
    });

    it('should load all tasks', async () => {
      const store = new TaskStore();
      const task1 = createTask({ id: '1', text: 'A' });
      const task2 = createTask({ id: '2', text: 'B' });

      await store.save(task1);
      await store.save(task2);

      const all = await store.load();
      expect(all).toHaveLength(2);
    });

    it('should return undefined for missing task', async () => {
      const store = new TaskStore();
      const task = await store.get('missing');
      expect(task).toBeUndefined();
    });
  });

  describe('query by status', () => {
    let store: TaskStore;

    beforeEach(async () => {
      store = new TaskStore();
      await store.save(
        createTask({ id: '1', text: 'A', status: 'pending' as TaskStatus })
      );
      await store.save(
        createTask({ id: '2', text: 'B', status: 'in_progress' as TaskStatus })
      );
      await store.save(
        createTask({ id: '3', text: 'C', status: 'completed' as TaskStatus })
      );
    });

    it('should get pending tasks', async () => {
      const pending = await store.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('1');
    });

    it('should get running tasks', async () => {
      const running = await store.getRunning();
      expect(running).toHaveLength(1);
      expect(running[0].id).toBe('2');
    });

    it('should get tasks by status', async () => {
      const completed = await store.getByStatus('completed' as TaskStatus);
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('3');
    });

    it('should count tasks', async () => {
      const total = await store.count();
      expect(total).toBe(3);

      const pending = await store.count('pending' as TaskStatus);
      expect(pending).toBe(1);
    });
  });

  describe('delete', () => {
    it('should soft-delete task', async () => {
      const store = new TaskStore();
      const task = createTask({ id: 't1', text: 'Test' });
      await store.save(task);

      await store.delete('t1');
      const deleted = await store.get('t1');

      expect(deleted?.status).toBe('deleted');
    });
  });

  describe('clear', () => {
    it('should clear all tasks', async () => {
      const store = new TaskStore();
      await store.save(createTask({ id: '1', text: 'A' }));
      await store.save(createTask({ id: '2', text: 'B' }));

      await store.clear();
      const all = await store.getAll();

      expect(all).toHaveLength(0);
    });
  });
});

describe('EventLog', () => {
  let tempDir: string;
  let logFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-log-'));
    logFile = path.join(tempDir, 'events.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('append', () => {
    it('should append event to log', async () => {
      const log = new EventLog();
      const event = {
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        task: createTask({ id: 'task-1' })
      };

      await log.append(event);
      const all = await log.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].taskId).toBe('task-1');
    });

    it('should persist to file', async () => {
      const log = new EventLog(logFile);
      const event = {
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString()
      };

      await log.append(event);
      expect(fs.existsSync(logFile)).toBe(true);
    });
  });

  describe('query', () => {
    let log: EventLog;

    beforeEach(async () => {
      log = new EventLog();
      const now = new Date();

      await log.append({
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date(now.getTime() - 10000).toISOString()
      });

      await log.append({
        type: 'started' as const,
        taskId: 'task-1',
        timestamp: new Date(now.getTime() - 5000).toISOString()
      });

      await log.append({
        type: 'completed' as const,
        taskId: 'task-1',
        timestamp: now.toISOString()
      });
    });

    it('should get all events', async () => {
      const all = await log.getAll();
      expect(all).toHaveLength(3);
    });

    it('should get events since timestamp', async () => {
      const now = new Date();
      const recent = await log.since(new Date(now.getTime() - 6000).toISOString());
      expect(recent.length).toBeGreaterThanOrEqual(2);
    });

    it('should get events for task', async () => {
      const events = await log.getForTask('task-1');
      expect(events).toHaveLength(3);
    });
  });

  describe('reconstruction', () => {
    it('should reconstruct task from events', async () => {
      const log = new EventLog();
      const task = createTask({ id: 'task-1', text: 'Test' });

      await log.append({
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        task
      });

      const reconstructed = await log.reconstruct('task-1');
      expect(reconstructed?.id).toBe('task-1');
      expect(reconstructed?.text).toBe('Test');
    });

    it('should use latest task state', async () => {
      const log = new EventLog();
      const task1 = createTask({ id: 'task-1', text: 'Original' });
      const task2 = createTask({ id: 'task-1', text: 'Updated' });

      await log.append({
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        task: task1
      });

      await log.append({
        type: 'updated' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        task: task2
      });

      const reconstructed = await log.reconstruct('task-1');
      expect(reconstructed?.text).toBe('Updated');
    });

    it('should reconstruct all tasks', async () => {
      const log = new EventLog();

      await log.append({
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        task: createTask({ id: 'task-1' })
      });

      await log.append({
        type: 'created' as const,
        taskId: 'task-2',
        timestamp: new Date().toISOString(),
        task: createTask({ id: 'task-2' })
      });

      const all = await log.reconstructAll();
      expect(all.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear events', async () => {
      const log = new EventLog();
      await log.append({
        type: 'created' as const,
        taskId: 'task-1',
        timestamp: new Date().toISOString()
      });

      await log.clear();
      const all = await log.getAll();

      expect(all).toHaveLength(0);
    });
  });
});

describe('StateManager', () => {
  let tempDir: string;
  let storePath: string;
  let logPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-manager-'));
    storePath = path.join(tempDir, 'store.json');
    logPath = path.join(tempDir, 'log.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should manage store and event log together', async () => {
    const manager = new StateManager(storePath, logPath);
    const task = createTask({ id: 'task-1', text: 'Test' });
    const event = {
      type: 'created' as const,
      taskId: 'task-1',
      timestamp: new Date().toISOString(),
      task
    };

    await manager.saveTask(task, event);

    const stored = await manager.getStore().get('task-1');
    const events = await manager.getEventLog().getAll();

    expect(stored?.id).toBe('task-1');
    expect(events).toHaveLength(1);
  });

  it('should reconstruct from events', async () => {
    const manager = new StateManager(storePath, logPath);
    const task = createTask({ id: 'task-1', text: 'Test' });

    await manager.saveTask(task, {
      type: 'created' as const,
      taskId: 'task-1',
      timestamp: new Date().toISOString(),
      task
    });

    const reconstructed = await manager.reconstruct();
    expect(reconstructed.get('task-1')?.text).toBe('Test');
  });
});
