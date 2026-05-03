/**
 * Task Orchestration v2: Task Model & DAG Tests
 */

import { describe, it, expect } from '@jest/globals';
import { TaskDAG, createTask, isCompleted, isFailed, isRunning, isPending } from '../../src/core/task';
import type { TaskStatus } from '../../src/types';

describe('TaskDAG', () => {
  describe('construction', () => {
    it('should create empty DAG', () => {
      const dag = new TaskDAG([]);
      expect(dag.getAllTasks()).toHaveLength(0);
    });

    it('should create DAG with single task', () => {
      const tasks = [createTask({ id: 'A', text: 'Task A' })];
      const dag = new TaskDAG(tasks);
      expect(dag.getAllTasks()).toHaveLength(1);
    });

    it('should create DAG with multiple tasks', () => {
      const tasks = [
        createTask({ id: 'A', text: 'Task A' }),
        createTask({ id: 'B', text: 'Task B' }),
        createTask({ id: 'C', text: 'Task C' })
      ];
      const dag = new TaskDAG(tasks);
      expect(dag.getAllTasks()).toHaveLength(3);
    });

    it('should preserve task order', () => {
      const tasks = [
        createTask({ id: 'X', text: 'X' }),
        createTask({ id: 'Y', text: 'Y' }),
        createTask({ id: 'Z', text: 'Z' })
      ];
      const dag = new TaskDAG(tasks);
      const all = dag.getAllTasks();
      expect(all.map(t => t.id)).toEqual(['X', 'Y', 'Z']);
    });
  });

  describe('topologicalSort', () => {
    it('should sort single task', () => {
      const tasks = [createTask({ id: 'A', text: 'A' })];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toEqual([['A']]);
    });

    it('should sort linear chain A→B→C', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'] })
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toEqual([['A'], ['B'], ['C']]);
    });

    it('should batch parallel tasks A,B → C', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: [] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['A', 'B'] })
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(2);
      expect(sorted[0]).toEqual(expect.arrayContaining(['A', 'B']));
      expect(sorted[1]).toEqual(['C']);
    });

    it('should handle diamond pattern A→B,C→D', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['A'] }),
        createTask({ id: 'D', text: 'D', blockedBy: ['B', 'C'] })
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted[0]).toEqual(['A']);
      expect(sorted[1]).toEqual(expect.arrayContaining(['B', 'C']));
      expect(sorted[2]).toEqual(['D']);
    });

    it('should handle all parallel (no deps)', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: [] }),
        createTask({ id: 'C', text: 'C', blockedBy: [] })
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toHaveLength(3);
    });

    it('should handle all sequential (full chain)', () => {
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(
          createTask({
            id: `T${i}`,
            text: `Task ${i}`,
            blockedBy: i === 0 ? [] : [`T${i - 1}`]
          })
        );
      }
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(5);
      sorted.forEach(batch => expect(batch).toHaveLength(1));
    });

    it('should handle complex multi-level DAG', () => {
      const tasks = [
        createTask({ id: '1', text: '1', blockedBy: [] }),
        createTask({ id: '2', text: '2', blockedBy: ['1'] }),
        createTask({ id: '3', text: '3', blockedBy: ['1'] }),
        createTask({ id: '4', text: '4', blockedBy: ['2', '3'] }),
        createTask({ id: '5', text: '5', blockedBy: [] }),
        createTask({ id: '6', text: '6', blockedBy: ['4', '5'] })
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      const index: Record<string, number> = {};
      sorted.forEach((batch, i) => batch.forEach(id => (index[id] = i)));
      expect(index['1']).toBeLessThan(index['2']);
      expect(index['1']).toBeLessThan(index['3']);
      expect(index['2']).toBeLessThan(index['4']);
      expect(index['3']).toBeLessThan(index['4']);
      expect(index['4']).toBeLessThan(index['6']);
      expect(index['5']).toBeLessThan(index['6']);
    });
  });

  describe('hasCycle', () => {
    it('should detect simple 2-node cycle A→B→A', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['B'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).toThrow(/cycle/i);
    });

    it('should detect 3-node cycle A→B→C→A', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['C'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).toThrow(/cycle/i);
    });

    it('should detect 4-node cycle', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['D'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'] }),
        createTask({ id: 'D', text: 'D', blockedBy: ['C'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).toThrow(/cycle/i);
    });

    it('should return false for valid DAG', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).not.toThrow();
    });

    it('should return false for single task', () => {
      const tasks = [createTask({ id: 'A', text: 'A', blockedBy: [] })];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).not.toThrow();
    });

    it('should return false for linear chain', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).not.toThrow();
    });

    it('should return false for fully parallel', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: [] }),
        createTask({ id: 'C', text: 'C', blockedBy: [] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).not.toThrow();
    });

    it('cycle error should include cycle path', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['B'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      expect(() => dag.hasCycle()).toThrow(/A.*B/);
    });
  });

  describe('getUnblocked', () => {
    it('should return tasks with no dependencies', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      const unblocked = dag.getUnblocked();
      expect(unblocked).toHaveLength(1);
      expect(unblocked[0].id).toBe('A');
    });

    it('should return all parallel tasks', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: [] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      const unblocked = dag.getUnblocked();
      expect(unblocked).toHaveLength(2);
      expect(unblocked.map(t => t.id).sort()).toEqual(['A', 'B']);
    });

    it('should filter by status', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [], status: 'pending' as TaskStatus }),
        createTask({ id: 'B', text: 'B', blockedBy: [], status: 'in_progress' as TaskStatus })
      ];
      const dag = new TaskDAG(tasks);
      const unblocked = dag.getUnblocked('pending' as TaskStatus);
      expect(unblocked).toHaveLength(1);
      expect(unblocked[0].id).toBe('A');
    });

    it('should return empty if all blocked', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [], status: 'completed' as TaskStatus }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'], status: 'pending' as TaskStatus }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'], status: 'pending' as TaskStatus })
      ];
      const dag = new TaskDAG(tasks);
      const unblocked = dag.getUnblocked('pending' as TaskStatus);
      expect(unblocked).toHaveLength(0);
    });
  });

  describe('Task helpers', () => {
    it('isCompleted should check status', () => {
      expect(isCompleted(createTask({ status: 'completed' as TaskStatus }))).toBe(true);
      expect(isCompleted(createTask({ status: 'skipped' as TaskStatus }))).toBe(true);
      expect(isCompleted(createTask({ status: 'pending' as TaskStatus }))).toBe(false);
    });

    it('isFailed should check status', () => {
      expect(isFailed(createTask({ status: 'failed' as TaskStatus }))).toBe(true);
      expect(isFailed(createTask({ status: 'pending' as TaskStatus }))).toBe(false);
    });

    it('isRunning should check status', () => {
      expect(isRunning(createTask({ status: 'in_progress' as TaskStatus }))).toBe(true);
      expect(isRunning(createTask({ status: 'pending' as TaskStatus }))).toBe(false);
    });

    it('isPending should check status', () => {
      expect(isPending(createTask({ status: 'pending' as TaskStatus }))).toBe(true);
      expect(isPending(createTask({ status: 'in_progress' as TaskStatus }))).toBe(false);
    });
  });

  describe('Task retrieval', () => {
    it('should get task by ID', () => {
      const tasks = [createTask({ id: 'A', text: 'A' })];
      const dag = new TaskDAG(tasks);
      const task = dag.getTask('A');
      expect(task?.id).toBe('A');
    });

    it('should return undefined for missing task', () => {
      const tasks = [createTask({ id: 'A', text: 'A' })];
      const dag = new TaskDAG(tasks);
      const task = dag.getTask('MISSING');
      expect(task).toBeUndefined();
    });

    it('should get tasks by status', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', status: 'pending' as TaskStatus }),
        createTask({ id: 'B', text: 'B', status: 'completed' as TaskStatus })
      ];
      const dag = new TaskDAG(tasks);
      const pending = dag.getByStatus('pending' as TaskStatus);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('A');
    });

    it('should get dependencies for task', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      const deps = dag.getDependencies('B');
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe('A');
    });

    it('should get dependents for task', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['A'] })
      ];
      const dag = new TaskDAG(tasks);
      const dependents = dag.getDependents('A');
      expect(dependents).toHaveLength(2);
      expect(dependents.map(t => t.id).sort()).toEqual(['B', 'C']);
    });
  });
});
