/**
 * Biome Fix Runner — biome check --write
 *
 * Auto-fixes JavaScript, TypeScript, and JSON via Biome.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { findConfigFileFromPath } from "../formatter/config.ts";
import type { FixRunner, FixResult } from "./types.ts";

export const biomeFix: FixRunner = {
  name: "biome",
  stage: "fix",

  isAvailable(filePath: string, cwd: string): boolean {
    return findConfigFileFromPath(filePath, ["biome.json", "biome.jsonc"], cwd) !== null;
  },

  async fix(filePath: string, timeoutMs: number): Promise<FixResult> {
    try {
      const result = spawnSync("biome", ["check", "--write", "--unsafe", filePath], {
        encoding: "utf-8",
        timeout: timeoutMs,
      });

      if (result.status === 0) {
        const output = result.stdout ?? "";
        const fixed = output.includes("Fixed");
        const detail = fixed ? "Fixed issues" : "No issues found";
        return { status: "succeeded", detail, changes: fixed ? 1 : 0 };
      }

      const error = result.stderr ?? result.stdout ?? "Unknown error";
      return { status: "failed", detail: error.slice(0, 100) };
    } catch (err: any) {
      return { status: "failed", detail: err.message || "Unknown error" };
    }
  },
};
