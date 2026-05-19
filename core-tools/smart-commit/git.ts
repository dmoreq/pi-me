/**
 * smart-commit — git primitives
 *
 * All functions are pure async wrappers around execFile.
 * They throw on non-zero exit so callers can handle errors explicitly.
 */

import { execFile } from "node:child_process";
import type { DirtyFile } from "./types.ts";

const GIT_TIMEOUT = 30_000;
const GIT_MAX_BUFFER = 10 * 1024 * 1024;
const DIFF_CHAR_LIMIT = 8_000;

// ─── Core executor ───────────────────────────────────────────────────────────

export function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) reject(new Error(`git ${args[0]} failed: ${stderr?.trim() || err.message}`));
        else resolve(stdout.trim());
      },
    );
  });
}

/** Like execGit but returns empty string instead of throwing on failure. */
export async function execGitSafe(args: string[], cwd: string): Promise<string> {
  try { return await execGit(args, cwd); }
  catch { return ""; }
}

// ─── Repo info ────────────────────────────────────────────────────────────────

export async function getRepoRoot(cwd: string): Promise<string> {
  return execGit(["rev-parse", "--show-toplevel"], cwd);
}

/** Returns the SHA of HEAD after a commit, or empty string on failure. */
export async function getHeadSha(cwd: string): Promise<string> {
  return execGitSafe(["rev-parse", "HEAD"], cwd);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Parse `git status --porcelain=v1 -u` output into DirtyFile records.
 * Both staged and unstaged files are returned; staged=true when the index
 * column is not ' ' or '?'.
 */
export async function listDirtyFiles(cwd: string, repoRoot: string): Promise<DirtyFile[]> {
  const out = await execGitSafe(["status", "--porcelain=v1", "-u"], cwd);
  if (!out) return [];

  const files: DirtyFile[] = [];
  for (const raw of out.split("\n")) {
    const line = raw.trimEnd();
    if (line.length < 4) continue;

    const xy = line.slice(0, 2);       // "XY" — two-char status code
    const x = xy[0];                    // index (staged) status
    const relPath = line.slice(3);      // file path relative to repo root

    // Renamed files: "R old -> new" — take the destination
    const actualRel = relPath.includes(" -> ") ? relPath.split(" -> ")[1] : relPath;

    const status = (["M", "A", "D", "R", "?", "U"].includes(x) ? x : "M") as DirtyFile["status"];
    const staged = x !== " " && x !== "?";

    files.push({
      absPath: `${repoRoot}/${actualRel}`,
      relPath: actualRel,
      status,
      staged,
    });
  }

  return files;
}

export function hasAnyChanges(files: DirtyFile[]): boolean {
  return files.length > 0;
}

// ─── Staging ─────────────────────────────────────────────────────────────────

export async function stageFiles(absPaths: string[], cwd: string): Promise<void> {
  if (absPaths.length === 0) return;
  await execGit(["add", "--", ...absPaths], cwd);
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export async function getDiffStatForFiles(relPaths: string[], cwd: string): Promise<string> {
  if (relPaths.length === 0) return "(no staged files)";
  const out = await execGitSafe(["diff", "--cached", "--stat", "--", ...relPaths], cwd);
  return out || "(no staged changes)";
}

export async function getDiffForFiles(
  relPaths: string[],
  cwd: string,
  includeUnstaged = false,
): Promise<string> {
  if (relPaths.length === 0) return "(no files)";
  const args = includeUnstaged
    ? ["diff", "--", ...relPaths]
    : ["diff", "--cached", "--", ...relPaths];
  const out = await execGitSafe(args, cwd);
  return out.length > DIFF_CHAR_LIMIT
    ? out.slice(0, DIFF_CHAR_LIMIT) + `\n... [truncated ${out.length - DIFF_CHAR_LIMIT} chars]`
    : out || "(empty diff)";
}

// ─── Commit ───────────────────────────────────────────────────────────────────

const COMMIT_MSG_RE = /^(feat|fix|docs|style|refactor|test|chore|perf|ci)(\(.+\))?: .{3,}/;

export function isValidConventionalCommit(message: string): boolean {
  return COMMIT_MSG_RE.test(message.trim().split("\n")[0]);
}

/**
 * Run `git commit -m <message>` and return the new HEAD SHA.
 * Throws if there is nothing staged or the message is invalid.
 */
export async function commitWithMessage(message: string, cwd: string): Promise<string> {
  const trimmed = message.trim();
  if (!isValidConventionalCommit(trimmed)) {
    throw new Error(
      `Commit message does not follow conventional commit format: "${trimmed.slice(0, 80)}"`,
    );
  }
  await execGit(["commit", "-m", trimmed], cwd);
  return getHeadSha(cwd);
}
