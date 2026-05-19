/**
 * smart-commit — file grouper
 *
 * Groups dirty files into logical commit groups based on directory scope.
 *
 * Algorithm:
 *   1. Strip the repo root from each file's path
 *   2. Compute a "scope path" = first two path segments
 *      ("core-tools/memory/src/store.ts" → "core-tools/memory")
 *      ("README.md" → "root")
 *   3. Group by scope path
 *   4. Derive a conventional-commit scope from the scope path
 *   5. Sort groups: more files first, then alphabetically
 */

import { basename, dirname, relative } from "node:path";
import type { CommitGroup, DirtyFile } from "./types.ts";

// Prefixes that are "container" segments and not meaningful as a scope on their own.
// When one of these is the outermost segment, we use the next one.
const CONTAINER_PREFIXES = new Set(["src", "lib", "packages", "apps", "modules"]);

/**
 * Derive the "scope path" — the 1- or 2-segment prefix used as the grouping key.
 * relPath is relative to repoRoot.
 */
function scopePath(relPath: string): string {
  const parts = relPath.split("/").filter(Boolean);

  if (parts.length === 0) return "root";
  if (parts.length === 1) return "root"; // file directly in repo root

  // Use first two segments as the scope path
  const first = parts[0];
  const second = parts[1];

  return `${first}/${second}`;
}

/**
 * Derive the conventional-commit scope string from a scope path.
 *
 * Rules:
 *   "root"              → "" (no scope)
 *   "core-tools/memory" → "memory"
 *   "authoring/commit-helper" → "commit-helper"
 *   "packages/ui"       → "ui"
 *   "src/auth"          → "auth"
 *   "README.md"         → "" (root-level)
 */
function deriveScope(sp: string): string {
  if (sp === "root") return "";

  const parts = sp.split("/").filter(Boolean);
  // Take the last meaningful segment
  // If the last part is a CONTAINER_PREFIX and there's a segment before it, use the first
  const last = parts[parts.length - 1];
  return last;
}

/**
 * Group a flat list of dirty files into logical CommitGroups.
 */
export function groupDirtyFiles(files: DirtyFile[], repoRoot: string): CommitGroup[] {
  const groupMap = new Map<string, DirtyFile[]>();

  for (const file of files) {
    const sp = scopePath(file.relPath);
    const bucket = groupMap.get(sp);
    if (bucket) bucket.push(file);
    else groupMap.set(sp, [file]);
  }

  const groups: CommitGroup[] = [];
  for (const [sp, groupFiles] of groupMap) {
    groups.push({
      label: sp,
      scope: deriveScope(sp),
      files: groupFiles,
    });
  }

  // Sort: more files first, then alphabetically by label for determinism
  groups.sort((a, b) => {
    const diff = b.files.length - a.files.length;
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });

  return groups;
}
