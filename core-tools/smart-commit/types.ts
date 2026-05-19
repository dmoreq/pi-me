/**
 * smart-commit — shared types
 */

export interface DirtyFile {
  absPath: string;
  relPath: string; // relative to repo root
  /** git status XY first char (index status) */
  status: "M" | "A" | "D" | "R" | "?" | "U";
  staged: boolean; // index status is not ' ' or '?'
}

export interface CommitGroup {
  /** Human-readable label, e.g. "core-tools/memory" */
  label: string;
  /** Conventional-commit scope derived from label, e.g. "memory". Empty string for root-level files. */
  scope: string;
  files: DirtyFile[];
}

export interface QualityResult {
  file: string;
  formatted: boolean;
  fixed: boolean;
  fixCount: number;
  errors: string[];
}

export interface CommitResult {
  group: CommitGroup;
  quality: QualityResult[];
  committed: boolean;
  sha?: string;
  message?: string;
  error?: string;
}
