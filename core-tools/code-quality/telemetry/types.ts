/**
 * Telemetry Trigger Types for Code Quality
 */

export interface CodeQualityNotification {
  stage: "format" | "fix" | "both";
  status: "success" | "failure";
  detail: string;      // "formatted (prettier)" / "fixed (3 issues)" / "format failed: timeout"
  filePath: string;
  duration?: number;   // milliseconds
}
