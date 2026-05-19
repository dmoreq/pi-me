import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { commitWithMessage, execGit, isValidConventionalCommit, listDirtyFiles, stageFiles } from "./git.ts";

describe("isValidConventionalCommit", () => {
  const valid = [
    "feat(memory): add prepared statement cache",
    "fix(parser): handle empty input",
    "refactor: remove unused code",
    "chore(deps): update dependencies",
    "docs(readme): fix installation steps",
    "test(smart-commit): add grouper tests",
    "perf(store): optimize Jaccard scan",
    "ci: add GitHub Actions workflow",
    "style(ui): reformat button components",
    "build: update package script",
    "feat!: change public API",
    "fix(api)!: remove deprecated route",
  ];

  const invalid = [
    "Added some stuff",                        // no type
    "feat: x",                                 // description too short (< 3 chars after ": ")
    "feat(): add something",                   // empty scope
    "FEAT: add something",                     // uppercase type
    "feat add something",                      // missing colon
    "",                                        // empty
    "wip: half done",                          // invalid type
    "feat(memory):",                           // missing description
    "feat: add trailing period.",              // subject should not end with a period
    `feat: ${"a".repeat(73)}`,                  // subject too long
  ];

  for (const msg of valid) {
    it(`accepts: ${msg}`, () => {
      assert.equal(isValidConventionalCommit(msg), true);
    });
  }

  for (const msg of invalid) {
    it(`rejects: ${msg || "(empty)"}`, () => {
      assert.equal(isValidConventionalCommit(msg), false);
    });
  }
});

describe("git integration", () => {
  async function withRepo<T>(fn: (repo: string) => Promise<T>): Promise<T> {
    const repo = await mkdtemp(join(tmpdir(), "smart-commit-"));
    try {
      await execGit(["init"], repo);
      await execGit(["config", "user.email", "test@example.com"], repo);
      await execGit(["config", "user.name", "Test User"], repo);
      await writeFile(join(repo, "tracked.txt"), "initial\n");
      await stageFiles([join(repo, "tracked.txt")], repo);
      await commitWithMessage("chore: initial commit", repo);
      return await fn(repo);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }

  it("parses unstaged deletions and paths with spaces from porcelain -z", async () => {
    await withRepo(async repo => {
      await rm(join(repo, "tracked.txt"));
      await writeFile(join(repo, "file with spaces.txt"), "hello\n");

      const files = await listDirtyFiles(repo, repo);
      const deleted = files.find(f => f.relPath === "tracked.txt");
      const untracked = files.find(f => f.relPath === "file with spaces.txt");

      assert.equal(deleted?.status, "D");
      assert.equal(deleted?.staged, false);
      assert.equal(untracked?.status, "?");
      assert.equal(untracked?.staged, false);
    });
  });

  it("keeps unrelated staged files out of pathspec commits", async () => {
    await withRepo(async repo => {
      await writeFile(join(repo, "group-a.txt"), "a\n");
      await writeFile(join(repo, "group-b.txt"), "b\n");
      await stageFiles([join(repo, "group-a.txt"), join(repo, "group-b.txt")], repo);

      const sha = await commitWithMessage("feat: add group a", repo, ["group-a.txt"]);
      const committedNames = await execGit(["show", "--name-only", "--format=", sha], repo);
      const stagedAfter = await execGit(["diff", "--cached", "--name-only"], repo);

      assert.equal(committedNames.trim(), "group-a.txt");
      assert.equal(stagedAfter.trim(), "group-b.txt");
    });
  });

  it("parses renamed files using the destination path", async () => {
    await withRepo(async repo => {
      await rename(join(repo, "tracked.txt"), join(repo, "renamed file.txt"));
      await execGit(["add", "-A"], repo);

      const files = await listDirtyFiles(repo, repo);
      const renamed = files.find(f => f.relPath === "renamed file.txt");

      assert.equal(renamed?.status, "R");
      assert.equal(renamed?.staged, true);
    });
  });
});
