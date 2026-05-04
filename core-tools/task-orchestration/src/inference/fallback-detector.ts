/**
 * FallbackIntentDetector — Chains an AI classifier with a manual fallback.
 *
 * Strategy:
 * 1. Try the AI (primary) classifier first via classifyAsync().
 * 2. If the AI throws or returns an invalid intent, fall through to
 *    the manual (fallback) classifier.
 * 3. The manual classifier is always synchronous and always succeeds.
 *
 * This gives best-effort AI-powered classification with zero-downtime
 * fallback to rule-based detection when Groq is unavailable.
 */

import type { IIntentClassifier, TaskIntent } from '../types';
import { AiIntentDetector } from './ai-intent-detector';
import { ManualIntentDetector } from './intent';

export class FallbackIntentDetector implements IIntentClassifier {
  private aiDetector: AiIntentDetector;
  private manualDetector: ManualIntentDetector;
  private preferManual: boolean;

  constructor(aiDetector: AiIntentDetector, manualDetector?: ManualIntentDetector) {
    this.aiDetector = aiDetector;
    this.manualDetector = manualDetector ?? new ManualIntentDetector();
    this.preferManual = false;
  }

  /**
   * Synchronous classify — always uses the manual detector.
   * Required by the IIntentClassifier interface for backward compatibility.
   * Callers that want AI-powered classification should use classifyAsync()
   * or go through TaskCapture.inferAsync().
   */
  classify(text: string): TaskIntent {
    return this.manualDetector.classify(text);
  }

  /**
   * Async classify — tries AI first, falls back to manual on failure.
   * This is the preferred path for callers that can await.
   * Returns { intent, source } to distinguish AI vs manual classification.
   */
  async classifyAsync(text: string): Promise<{ intent: TaskIntent; source: 'ai' | 'manual' }> {
    if (this.preferManual) {
      return { intent: this.manualDetector.classify(text), source: 'manual' };
    }

    try {
      const intent = await this.aiDetector.classifyAsync(text);
      return { intent, source: 'ai' };
    } catch (err) {
      // AI failed — log the error and fall back to manual
      console.debug(`[FallbackIntentDetector] AI classification failed, falling back to manual:`, (err as Error)?.message);
      return { intent: this.manualDetector.classify(text), source: 'manual' };
    }
  }

  /**
   * Get confidence estimate using the manual detector's scoring.
   * Falls back immediately — no AI call for confidence.
   */
  getConfidence(text: string, intent?: TaskIntent): number {
    return this.manualDetector.getConfidence(text, intent);
  }

  /**
   * Force manual-only mode. Useful when AI is known to be unavailable
   * (e.g., offline, rate-limited).
   */
  setPreferManual(prefer: boolean): void {
    this.preferManual = prefer;
  }
}
