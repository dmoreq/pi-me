/**
 * thinking-steps — Three-mode thinking-step rendering for Pi's TUI.
 * Simple ~270-line implementation using only pi's public API.
 *
 * Registers event handlers and commands eagerly; mode is restored
 * on session_start via the ExtensionContext.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import thinkingSteps from "./thinking-steps.ts";

export default function (pi: ExtensionAPI): void {
  try {
    thinkingSteps(pi);
  } catch (err) {
    console.error("[thinking-steps] Failed to load:", err);
  }
}
