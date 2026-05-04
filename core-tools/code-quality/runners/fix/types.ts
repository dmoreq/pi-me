/**
 * Fix Runner Types — auto-fix runners for linters
 *
 * Each fix runner knows how to detect its tool configuration and
 * run the appropriate `--fix` or `--write` command on a file.
 */

export interface FixResult {
  status: "succeeded" | "failed" | "skipped";
  detail: string;      // "Fixed 3 issues" / "Error: no config" / "Skipped"
  changes?: number;    // number of issues fixed
}

export interface FixRunner {
  readonly name: string;
  readonly stage: "fix";
  isAvailable(filePath: string, cwd: string): boolean;
  fix(filePath: string, timeoutMs: number): Promise<FixResult>;
}
