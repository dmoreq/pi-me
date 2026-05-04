/**
 * notify-utils — backwards-compatible re-export barrel.
 *
 * All implementations have been split into focused modules:
 *   audio.ts          — beep, speak, pronunciations
 *   terminal.ts       — detection, notifications, bring-to-front
 *   bg-notify-config.ts — config loading, notifyOnConfirm
 *
 * This file re-exports everything so existing imports keep working.
 */

export * from "./audio.js";
export * from "./terminal.js";
export * from "./bg-notify-config.js";

// ── Helpers that don't belong in any sub-module ──────────────────────────────

export function getCurrentDirName(): string {
  try { return process.cwd().split("/").pop() || "unknown"; } catch { return "unknown"; }
}

export function replaceMessageTemplates(message: string): string {
  const d = getCurrentDirName();
  return message.replace(/{session dir}/g, d).replace(/{dirname}/g, d);
}
