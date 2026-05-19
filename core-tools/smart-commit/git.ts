/**
 * smart-commit — git primitives
 *
 * All functions are pure async wrappers around execFile.
 * They throw on non-zero exit so callers can handle errors explicitly.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import type { DirtyFile } from "./types.ts";

const GIT_TIMEOUT = 30_000;
const GIT_MAX_BUFFER = 10 * 1024 * 1024;
const DIFF_CHAR_LIMIT = 8_000;

// ─── Core executor ───────────────────────────────────────────────────────────

function execGitRaw(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) reject(new Error(`git ${args[0]} failed: ${stderr?.trim() || err.message}`));
        else resolve(stdout);
      },
    );
  });
}

export async function execGit(args: string[], cwd: string): Promise<string> {
  return (await execGitRaw(args, cwd)).trim();
}

/** Like execGit but returns empty string instead of throwing on failure. */
export async function execGitSafe(args: string[], cwd: string): Promise<string> {
  try { return await execGit(args, cwd); }
  catch { return ""; }
}

async function execGitRawSafe(args: string[], cwd: string): Promise<string> {
  try { return await execGitRaw(args, cwd); }
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

function dirtyStatusFromXY(xy: string): DirtyFile["status"] {
  const [x = " ", y = " "] = xy;
  if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) return "U";
  const effective = x !== " " && x !== "?" ? x : y;
  return (["M", "A", "D", "R", "?"].includes(effective) ? effective : "M") as DirtyFile["status"];
}

/**
 * Parse `git status --porcelain=v1 -z -u` output into DirtyFile records.
 * Both staged and unstaged files are returned; staged=true when the index
 * column is not ' ' or '?'. The NUL format preserves spaces, quotes, unicode,
 * and rename paths without needing shell-style unquoting.
 */
export async function listDirtyFiles(cwd: string, repoRoot: string): Promise<DirtyFile[]> {
  const out = await execGitRawSafe(["status", "--porcelain=v1", "-z", "-u"], cwd);
  if (!out) return [];

  const entries = out.split("\0").filter(Boolean);
  const files: DirtyFile[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4) continue;

    const xy = entry.slice(0, 2);
    const x = xy[0] ?? " ";
    const relPath = entry.slice(3);

    // In porcelain v1 -z, rename/copy records are followed by the source path.
    // The first path is the destination, which is the path we should stage/commit.
    if (x === "R" || x === "C") i++;

    const status = dirtyStatusFromXY(xy);
    const staged = x !== " " && x !== "?";

    files.push({
      absPath: join(repoRoot, relPath),
      relPath,
      status,
      staged,
    });
  }

  return files;
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
  return truncateDiff(out || "(empty diff)");
}

export async function getCommitStat(sha: string, cwd: string): Promise<string> {
  if (!sha) return "";
  return execGitSafe(["show", "--stat", "--oneline", "--name-status", "--format=short", sha], cwd);
}

function truncateDiff(out: string): string {
  return out.length > DIFF_CHAR_LIMIT
    ? out.slice(0, DIFF_CHAR_LIMIT) + `\n... [truncated ${out.length - DIFF_CHAR_LIMIT} chars]`
    : out;
}

// ─── Commit ───────────────────────────────────────────────────────────────────

const COMMIT_TYPES = "feat|fix|docs|style|refactor|test|chore|perf|ci|build";
const COMMIT_MSG_RE = new RegExp(
  `^(${COMMIT_TYPES})(\\([A-Za-z0-9._/-]+\\))?!?: (?!.*\\.$).{3,72}$`,
);

export function isValidConventionalCommit(message: string): boolean {
  return COMMIT_MSG_RE.test(message.trim().split("\n")[0]);
}

/**
 * Run `git commit -m <message>` and return the new HEAD SHA.
 * When relPaths is provided, use a pathspec commit so unrelated staged files
 * remain staged and are not included in this group's commit.
 */
export async function commitWithMessage(
  message: string,
  cwd: string,
  relPaths: string[] = [],
): Promise<string> {
  const trimmed = message.trim();
  if (!isValidConventionalCommit(trimmed)) {
    throw new Error(
      `Commit message does not follow conventional commit format: "${trimmed.slice(0, 80)}"`,
    );
  }

  const args = relPaths.length > 0
    ? ["commit", "-m", trimmed, "--only", "--", ...relPaths]
    : ["commit", "-m", trimmed];

  await execGit(args, cwd);
  return getHeadSha(cwd);
}
