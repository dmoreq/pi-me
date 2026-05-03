/**
 * Task Orchestration v2: TaskCapture Tests
 */

import { describe, it, expect } from '@jest/globals';
import { TaskCapture } from '../../src/core/capture';

describe('TaskCapture', () => {
  let capture: TaskCapture;

  beforeEach(() => {
    capture = new TaskCapture();
  });

  describe('infer', () => {
    it('should infer single task', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix the login bug' }
      ]);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].text).toContain('login');
      expect(result.tasks[0].intent).toBe('fix');
    });

    it('should infer multiple tasks with "and"', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix login and update docs' }
      ]);
      expect(result.tasks.length).toBeGreaterThanOrEqual(2);
      expect(result.tasks[0].intent).toBe('fix');
    });

    it('should infer multiple tasks from comma list', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix auth, refactor module, add tests' }
      ]);
      expect(result.tasks.length).toBeGreaterThanOrEqual(3);
      expect(result.tasks[0].intent).toBe('fix');
      expect(result.tasks[1].intent).toBe('refactor');
      expect(result.tasks[2].intent).toBe('test');
    });

    it('should handle empty message', () => {
      const result = capture.infer([
        { role: 'user', content: '' }
      ]);
      expect(result.tasks).toHaveLength(0);
    });

    it('should ignore assistant messages', () => {
      const result = capture.infer([
        { role: 'assistant', content: 'Doing it now' }
      ]);
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe('segmentMessage', () => {
    it('should segment compound message with "and"', () => {
      const segments = capture.segmentMessage('Fix X and test Y');
      expect(segments.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle single message', () => {
      const segments = capture.segmentMessage('Fix the login bug');
      expect(segments).toHaveLength(1);
    });

    it('should handle empty message', () => {
      const segments = capture.segmentMessage('');
      expect(segments).toHaveLength(0);
    });
  });

  describe('extractText', () => {
    it('should strip parenthetical notes', () => {
      const text = capture.extractText('Fix login (handle edge cases)');
      expect(text).not.toContain('handle edge cases');
      expect(text).toContain('Fix login');
    });

    it('should trim whitespace', () => {
      const text = capture.extractText('  Fix login  ');
      expect(text).toBe('Fix login');
    });

    it('should remove quotes', () => {
      const text = capture.extractText('"Fix login"');
      expect(text).toBe('Fix login');
    });
  });

  describe('priority inference', () => {
    it('should detect high priority', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix the critical security bug urgently' }
      ]);
      expect(result.tasks[0].priority).toBe('high');
    });

    it('should detect normal priority by default', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix the login bug' }
      ]);
      expect(result.tasks[0].priority).toBe('normal');
    });

    it('should detect low priority', () => {
      const result = capture.infer([
        { role: 'user', content: 'Maybe refactor the module eventually' }
      ]);
      expect(result.tasks[0].priority).toBe('low');
    });
  });

  describe('tag inference', () => {
    it('should extract api tag', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix the API endpoint' }
      ]);
      expect(result.tasks[0].tags).toContain('api');
    });

    it('should extract ui tag', () => {
      const result = capture.infer([
        { role: 'user', content: 'Fix the login page UI' }
      ]);
      expect(result.tasks[0].tags).toContain('ui');
    });

    it('should extract database tag', () => {
      const result = capture.infer([
        { role: 'user', content: 'Optimize database query' }
      ]);
      expect(result.tasks[0].tags).toContain('database');
    });

    it('should extract testing tag', () => {
      const result = capture.infer([
        { role: 'user', content: 'Add tests for auth' }
      ]);
      expect(result.tasks[0].tags).toContain('testing');
    });
  });

  describe('multi-turn', () => {
    it('should accumulate tasks from multiple messages', () => {
      const first = capture.infer([
        { role: 'user', content: 'Fix login' }
      ]);
      expect(first.tasks).toHaveLength(1);

      const second = capture.infer([
        { role: 'user', content: 'Fix login' },
        { role: 'user', content: 'Update docs' }
      ]);
      expect(second.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
