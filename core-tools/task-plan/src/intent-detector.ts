/**
 * Task-Plan Intent Detector — Re-export from centralized core-tools/intent/.
 *
 * This file is kept as a thin re-export shim for backward compatibility.
 * All actual logic lives in core-tools/intent/detector.ts.
 *
 * New code should import directly from core-tools/intent/detector.ts.
 */

import type { IIntentClassifier, TaskIntent } from "./types.ts";
export type { IIntentClassifier, TaskIntent };

export {
  AiTaskIntentDetector,
  ManualTaskIntentDetector,
  FallbackTaskIntentDetector,
  createTaskIntentDetector,
  // Backward compat aliases
  createTaskIntentDetector as createIntentDetector,
  ManualTaskIntentDetector as ManualIntentDetector,
  AiTaskIntentDetector as AiIntentDetector,
  FallbackTaskIntentDetector as FallbackIntentDetector,
} from "../../intent/detector.ts";
