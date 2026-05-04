/**
 * Code Quality Telemetry Triggers
 *
 * Fires pi-telemetry notifications on format/fix events.
 */

import { basename } from "node:path";
import { getTelemetry } from "pi-telemetry";
import type { CodeQualityNotification } from "./types.ts";

export function notifyCodeQuality(notification: CodeQualityNotification): void {
  const t = getTelemetry();
  if (!t) return;

  const file = basename(notification.filePath);
  let text = "";
  let variant: "success" | "warning" | "info" = "info";
  let message = "";

  if (notification.status === "success") {
    variant = "success";
    if (notification.stage === "format") {
      text = "format-ok";
      message = `✅ ${file}: ${notification.detail}`;
    } else if (notification.stage === "fix") {
      text = "fix-ok";
      message = `✅ ${file}: ${notification.detail}`;
    } else {
      text = "code-quality";
      message = `✅ ${file}: ${notification.detail}`;
    }
  } else {
    variant = "warning";
    if (notification.stage === "format") {
      text = "format-err";
      message = `⚠️ ${file}: ${notification.detail}`;
    } else if (notification.stage === "fix") {
      text = "fix-err";
      message = `⚠️ ${file}: ${notification.detail}`;
    } else {
      text = "code-quality-err";
      message = `⚠️ ${file}: ${notification.detail}`;
    }
  }

  t.notify(message, {
    package: "code-quality",
    badge: { text, variant },
  });
}
