/**
 * Task-Plan Intent Detector — Re-export from centralized core-tools/intent/.
 * All actual logic lives in core-tools/intent/detector.ts.
 */

import type { IIntentClassifier, TaskIntent } from "./types.ts";
export type { IIntentClassifier, TaskIntent };

export {
  AiTaskIntentDetector,
  ManualTaskIntentDetector,
  FallbackTaskIntentDetector,
  createTaskIntentDetector,
} from "../../intent/detector.ts";
