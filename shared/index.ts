/**
 * Shared utilities module
 *
 * Provides notification functionality (beep, speak, bring-to-front),
 * config loading, lazy module loading, and package registration
 * for extensions like background-notify and safe-git.
 */

export * from "./types";
export * from "./audio.js";
export * from "./terminal.js";
export * from "./bg-notify-config.js";
export * from "./notify-utils";
export * from "./lifecycle.js";
export * from "./telemetry-helpers.js";
export * from "./ext-state";
export * from "./register-package.js";
