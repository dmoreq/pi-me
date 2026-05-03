/**
 * Task Orchestration v2: Intent Classification Tests
 */

import { describe, it, expect } from '@jest/globals';
import { RegexIntentClassifier } from '../../src/inference/intent';

describe('RegexIntentClassifier', () => {
  let classifier: RegexIntentClassifier;

  beforeEach(() => {
    classifier = new RegexIntentClassifier();
  });

  describe('classify', () => {
    it('should classify fix intent', () => {
      expect(classifier.classify('Fix the login bug')).toBe('fix');
      expect(classifier.classify('Debug auth flow')).toBe('fix');
      expect(classifier.classify('Resolve performance issue')).toBe('fix');
      expect(classifier.classify('Repair broken test')).toBe('fix');
      expect(classifier.classify('Hotfix security vulnerability')).toBe('fix');
    });

    it('should classify refactor intent', () => {
      expect(classifier.classify('Refactor module')).toBe('refactor');
      expect(classifier.classify('Clean up old code')).toBe('refactor');
      expect(classifier.classify('Rewrite the parser')).toBe('refactor');
      expect(classifier.classify('Optimize query performance')).toBe('refactor');
      expect(classifier.classify('Improve error handling')).toBe('refactor');
    });

    it('should classify test intent', () => {
      expect(classifier.classify('Add unit tests')).toBe('test');
      expect(classifier.classify('Write integration test')).toBe('test');
      expect(classifier.classify('Test the API endpoint')).toBe('test');
      expect(classifier.classify('Add spec for auth')).toBe('test');
    });

    it('should classify docs intent', () => {
      expect(classifier.classify('Document the API')).toBe('docs');
      expect(classifier.classify('Update README')).toBe('docs');
      expect(classifier.classify('Write user guide')).toBe('docs');
      expect(classifier.classify('Add code comments')).toBe('docs');
    });

    it('should classify deploy intent', () => {
      expect(classifier.classify('Deploy to staging')).toBe('deploy');
      expect(classifier.classify('Release v1.0')).toBe('deploy');
      expect(classifier.classify('Publish package')).toBe('deploy');
      expect(classifier.classify('Ship new feature')).toBe('deploy');
    });

    it('should classify analyze intent', () => {
      expect(classifier.classify('Analyze the logs')).toBe('analyze');
      expect(classifier.classify('Investigate crash')).toBe('analyze');
      expect(classifier.classify('Review code changes')).toBe('analyze');
      expect(classifier.classify('Check for regressions')).toBe('analyze');
    });

    it('should respect case insensitivity', () => {
      expect(classifier.classify('FIX THE BUG')).toBe('fix');
      expect(classifier.classify('Fix The Bug')).toBe('fix');
      expect(classifier.classify('fix the bug')).toBe('fix');
    });

    it('should handle punctuation', () => {
      expect(classifier.classify('Fix the login bug!')).toBe('fix');
      expect(classifier.classify('Fix: login bug')).toBe('fix');
    });

    it('should fallback to analyze for unknown', () => {
      expect(classifier.classify('Some random text')).toBe('analyze');
      expect(classifier.classify('Just thinking about stuff')).toBe('analyze');
    });

    it('should handle empty text', () => {
      expect(classifier.classify('')).toBe('analyze');
      expect(classifier.classify('   ')).toBe('analyze');
    });
  });

  describe('getSupportedIntents', () => {
    it('should return all supported intents', () => {
      const intents = classifier.getSupportedIntents();
      expect(intents).toContain('fix');
      expect(intents).toContain('refactor');
      expect(intents).toContain('test');
      expect(intents).toContain('docs');
      expect(intents).toContain('deploy');
      expect(intents).toContain('analyze');
    });
  });
});
