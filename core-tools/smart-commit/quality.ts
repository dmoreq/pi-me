/**
 * smart-commit — quality runner
 *
 * Quality tooling is optional in this package. When no formatter/fixer bundle is
 * present, smart-commit continues without blocking commits.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { DirtyFile, QualityResult } from "./types.ts";

/**
 * Run format + fix on a single file.
 * Returns a QualityResult — never throws.
 */
async function runQualityOnFile(
  file: DirtyFile,
  _repoRoot: string,
  _pi: ExtensionAPI,
): Promise<QualityResult> {
  return {
    file: file.relPath,
    formatted: false,
    fixed: false,
    fixCount: 0,
    errors: [],
  };
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
