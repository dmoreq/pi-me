import { describe, it, expect } from '@jest/globals';
import { DependencyResolver } from '../../src/core/dependency';
import { createTask } from '../../src/core/task';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('build from blockedBy', () => {
    it('should build DAG with explicit blockedBy', () => {
      const tasks = [
        createTask({ id: 'A', text: 'Fix', blockedBy: [] }),
        createTask({ id: 'B', text: 'Test', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'Deploy', blockedBy: ['B'] })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      expect(sorted).toEqual([['A'], ['B'], ['C']]);
    });

    it('should handle undefined blockedBy', () => {
      const tasks = [
        createTask({ id: 'A', text: 'Fix' }),
        createTask({ id: 'B', text: 'Test', blockedBy: ['A'] })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      expect(sorted).toEqual([['A'], ['B']]);
    });

    it('should merge blockedBy correctly', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['A', 'B'] })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      expect(sorted[0]).toEqual(['A']);
      expect(sorted[1]).toEqual(['B']);
      expect(sorted[2]).toEqual(['C']);
    });
  });

  describe('build from topic', () => {
    it('should auto-sequence tasks by topic', () => {
      const tasks = [
        createTask({ id: '1', text: 'Fix auth', topic: 'auth' }),
        createTask({ id: '2', text: 'Test auth', topic: 'auth' }),
        createTask({ id: '3', text: 'Update docs', topic: 'docs' })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      // Auth tasks should be sequential
      const batch1 = sorted.flat();
      const idx1 = batch1.indexOf('1');
      const idx2 = batch1.indexOf('2');
      expect(idx1).toBeLessThan(idx2);
    });

    it('should handle multiple topics independently', () => {
      const tasks = [
        createTask({ id: 'A1', text: 'A1', topic: 'A' }),
        createTask({ id: 'A2', text: 'A2', topic: 'A' }),
        createTask({ id: 'B1', text: 'B1', topic: 'B' }),
        createTask({ id: 'B2', text: 'B2', topic: 'B' })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      // A and B topics should be independent
      const allTasks = sorted.flat();
      const a1Idx = allTasks.indexOf('A1');
      const a2Idx = allTasks.indexOf('A2');
      const b1Idx = allTasks.indexOf('B1');
      const b2Idx = allTasks.indexOf('B2');

      expect(a1Idx).toBeLessThan(a2Idx);
      expect(b1Idx).toBeLessThan(b2Idx);
    });
  });

  describe('build from sequenceOrder', () => {
    it('should order tasks by sequenceOrder', () => {
      const tasks = [
        createTask({ id: '3', text: 'Third', sequenceOrder: 3 }),
        createTask({ id: '1', text: 'First', sequenceOrder: 1 }),
        createTask({ id: '2', text: 'Second', sequenceOrder: 2 })
      ];

      const dag = resolver.build(tasks);
      const sorted = dag.topologicalSort();

      expect(sorted.flat()).toEqual(['1', '2', '3']);
    });
  });

  describe('cycle detection', () => {
    it('should reject simple cycle A→B→A', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['B'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];

      expect(() => resolver.build(tasks)).toThrow(/cycle/i);
    });

    it('should reject 3-node cycle', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: ['C'] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] }),
        createTask({ id: 'C', text: 'C', blockedBy: ['B'] })
      ];

      expect(() => resolver.build(tasks)).toThrow(/cycle/i);
    });

    it('should accept valid DAG', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['A'] })
      ];

      expect(() => resolver.build(tasks)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle missing dependencies gracefully', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [] }),
        createTask({ id: 'B', text: 'B', blockedBy: ['MISSING'] })
      ];

      const dag = resolver.build(tasks);
      expect(dag).toBeDefined();
    });
  });

  describe('inference', () => {
    it('should infer from code references', () => {
      const tasks = [
        createTask({ id: 'auth', text: 'Implement auth.ts' }),
        createTask({ id: 'tests', text: 'Test auth.ts' })
      ];

      const deps = resolver.inferFromCodeReferences(
        'Add tests for auth.ts',
        tasks
      );

      expect(deps).toContain('auth');
    });

    it('should infer sequential dependency from "then"', () => {
      const prev = [createTask({ id: 'fix', text: 'Fix auth' })];

      const dep = resolver.inferSequential('then write docs', prev);

      expect(dep).toBe('fix');
    });

    it('should handle no sequential keyword', () => {
      const prev = [createTask({ id: 'a', text: 'A' })];

      const dep = resolver.inferSequential('just do it', prev);

      expect(dep).toBeUndefined();
    });
  });

  describe('merge all dependencies', () => {
    it('should deduplicate dependencies', () => {
      const tasks = [
        createTask({ id: 'A', text: 'A', blockedBy: [], topic: 'T' }),
        createTask({
          id: 'B',
          text: 'B',
          blockedBy: ['A'],
          topic: 'T'
        })
      ];

      const dag = resolver.build(tasks);
      const task = dag.getTask('B');

      const blockedBy = task?.blockedBy || [];
      const uniqueCount = new Set(blockedBy).size;
      expect(uniqueCount).toBe(blockedBy.length);
    });
  });
});
