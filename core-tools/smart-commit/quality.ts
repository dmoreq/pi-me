/**
 * smart-commit — quality runner
 *
 * Runs format + lint-fix on a list of files before staging.
 * Deliberately never throws — quality failures are warnings, not blockers.
 *
 * Reuses:
 *   - formatFile() from core-tools/code-quality/runners/formatter/dispatch.ts
 *   - FIX_RUNNERS (biome, eslint, ruff) from core-tools/code-quality/runners/fix/index.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { formatFile } from "../code-quality/runners/formatter/dispatch.ts";
import { FIX_RUNNERS } from "../code-quality/runners/fix/index.ts";
import type { DirtyFile, QualityResult } from "./types.ts";

const QUALITY_TIMEOUT_MS = 30_000;

/**
 * Run format + fix on a single file.
 * Returns a QualityResult — never throws.
 */
async function runQualityOnFile(
  file: DirtyFile,
  repoRoot: string,
  pi: ExtensionAPI,
): Promise<QualityResult> {
  const result: QualityResult = {
    file: file.relPath,
    formatted: false,
    fixed: false,
    fixCount: 0,
    errors: [],
  };

  // ── Format ──────────────────────────────────────────────────────────────
  try {
    const summaries: string[] = [];
    await formatFile(
      pi,
      repoRoot,
      file.absPath,
      QUALITY_TIMEOUT_MS,
      (summary) => {
        if (summary.status === "succeeded") result.formatted = true;
        else if (summary.failureMessage) summaries.push(summary.failureMessage);
      },
      (warning) => result.errors.push(`format warning: ${warning}`),
    );
    if (summaries.length > 0) result.errors.push(...summaries);
  } catch (err: any) {
    result.errors.push(`format error: ${err?.message ?? String(err)}`);
  }

  // ── Fix ─────────────────────────────────────────────────────────────────
  for (const runner of FIX_RUNNERS) {
    try {
      if (!runner.isAvailable(file.absPath, repoRoot)) continue;
      const fr = await runner.fix(file.absPath, QUALITY_TIMEOUT_MS);
      if (fr.status === "succeeded") {
        result.fixed = true;
        result.fixCount += fr.changes ?? 0;
      } else if (fr.status === "failed") {
        result.errors.push(`${runner.name}: ${fr.detail}`);
      }
    } catch (err: any) {
      result.errors.push(`${runner.name} error: ${err?.message ?? String(err)}`);
    }
  }

  return result;
}

/**
 * Run format + fix on all non-deleted files in a group.
 * Deleted files are skipped silently.
 */
export async function runQualityOnFiles(
  files: DirtyFile[],
  repoRoot: string,
  pi: ExtensionAPI,
): Promise<QualityResult[]> {
  const results: QualityResult[] = [];

  for (const file of files) {
    // Skip deletions — nothing to format/fix in a deleted file
    if (file.status === "D") continue;

    const r = await runQualityOnFile(file, repoRoot, pi);
    results.push(r);
  }

  return results;
}

/** Summarize quality results into a short human-readable string. */
export function summarizeQuality(results: QualityResult[]): string {
  const formatted = results.filter(r => r.formatted).length;
  const fixed = results.filter(r => r.fixed).length;
  const errors = results.flatMap(r => r.errors).length;

  const parts: string[] = [];
  if (formatted > 0) parts.push(`${formatted} formatted`);
  if (fixed > 0) parts.push(`${fixed} fixed`);
  if (errors > 0) parts.push(`${errors} warning(s)`);
  return parts.length > 0 ? parts.join(", ") : "no changes";
}
