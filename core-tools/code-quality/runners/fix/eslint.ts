/**
 * ESLint Fix Runner — eslint --fix
 *
 * Auto-fixes JavaScript and TypeScript via ESLint.
 */

import { spawnSync } from "node:child_process";
import { findConfigFileFromPath } from "../formatter/config.ts";
import type { FixRunner, FixResult } from "./types.ts";

export const eslintFix: FixRunner = {
  name: "eslint",
  stage: "fix",

  isAvailable(filePath: string, cwd: string): boolean {
    return (
      findConfigFileFromPath(
        filePath,
        [".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.yaml", "eslint.config.js"],
        cwd,
      ) !== null
    );
  },

  async fix(filePath: string, timeoutMs: number): Promise<FixResult> {
    try {
      const result = spawnSync("npx", ["eslint", "--fix", filePath], {
        encoding: "utf-8",
        timeout: timeoutMs,
      });

      if (result.status === 0) {
        const output = result.stdout ?? "";
        // ESLint doesn't report fix count easily, assume success = 1+ fixes
        return { status: "succeeded", detail: "Fixed issues", changes: 1 };
      }

      const error = result.stderr ?? result.stdout ?? "Failed to fix";
      return { status: "failed", detail: error.slice(0, 100) };
    } catch (err: any) {
      return { status: "failed", detail: err.message || "Unknown error" };
    }
  },
};
