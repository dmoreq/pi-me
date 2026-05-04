/**
 * Ruff Fix Runner — ruff check --fix
 *
 * Auto-fixes Python via Ruff.
 */

import { spawnSync } from "node:child_process";
import { findConfigFileFromPath } from "../formatter/config.ts";
import type { FixRunner, FixResult } from "./types.ts";

export const ruffFix: FixRunner = {
  name: "ruff",
  stage: "fix",

  isAvailable(filePath: string, cwd: string): boolean {
    return (
      findConfigFileFromPath(filePath, ["pyproject.toml", "ruff.toml", ".ruff.toml"], cwd) !== null
    );
  },

  async fix(filePath: string, timeoutMs: number): Promise<FixResult> {
    try {
      const result = spawnSync("ruff", ["check", "--fix", filePath], {
        encoding: "utf-8",
        timeout: timeoutMs,
      });

      if (result.status === 0 || result.status === 1) {
        // Ruff exits with 1 even if fixes were applied
        const output = result.stdout ?? "";
        const fixed = output.includes("fixed");
        const detail = fixed ? "Fixed issues" : "No issues found";
        return { status: "succeeded", detail, changes: fixed ? 1 : 0 };
      }

      const error = result.stderr ?? result.stdout ?? "Failed to fix";
      return { status: "failed", detail: error.slice(0, 100) };
    } catch (err: any) {
      return { status: "failed", detail: err.message || "Unknown error" };
    }
  },
};
