/**
 * Shared utilities module
 *
 * Provides notification functionality (beep, speak, bring-to-front),
 * config loading, lazy module loading, and package registration
 * for extensions like background-notify and safe-git.
 */

export * from "./types";
export * from "./notify-utils";
export * from "./ext-state";
export * from "./register-package.js";
