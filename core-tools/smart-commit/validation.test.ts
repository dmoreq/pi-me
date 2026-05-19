/**
 * smart-commit validation and error-handling tests
 *
 * Tests input validation, error conditions, and edge cases that might crash
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { isValidConventionalCommit } from "./git.ts";
import { groupDirtyFiles } from "./grouper.ts";
import { buildCommitPrompt } from "./prompt.ts";
import type { DirtyFile, CommitGroup } from "./types.ts";

describe("input validation", () => {
  describe("commit message validation (strict RFC compliance)", () => {
    const validMessages = [
      "feat: add new feature",
      "fix: correct a bug",
      "docs: update documentation",
      "style: apply code formatting",
      "refactor: restructure code",
      "test: add unit tests",
      "chore: update dependencies",
      "perf: optimize performance",
      "ci: update CI/CD config",
      "feat(api): add endpoint",
      "fix(parser): handle null input",
      "refactor(core): simplify logic",
      "feat: abc",
      "feat(a): abc",
      "feat(my-scope): description",
      "feat(scope/nested): description",
    ];

    for (const msg of validMessages) {
      it(`accepts valid: "${msg}"`, () => {
        assert.equal(isValidConventionalCommit(msg), true);
      });
    }

    const invalidMessages = [
      "",
      "   ",
      "add feature",
      "FEAT: add feature",
      "feat Add feature",
      "feat: xy",
      "feat: ",
      "feat():",
      "feat(scope):",
      "feat(scope) description",
      "feat: ab\nmore details",
      "feat: 🚀",
      "unknown: add something",
    ];

    for (const msg of invalidMessages) {
      it(`rejects invalid: "${msg || "(empty)"}"`, () => {
        assert.equal(isValidConventionalCommit(msg), false);
      });
    }

    it("handles multiline messages (validates first line only)", () => {
      assert.equal(isValidConventionalCommit("feat: add feature\n"), true);
      assert.equal(isValidConventionalCommit("feat: add feature\nmore details\neven more"), true);
      assert.equal(isValidConventionalCommit("feat: ab\nmore details"), false);
    });
  });

  describe("dirty file path handling", () => {
    it("handles paths with special characters", () => {
      const files: DirtyFile[] = [
        { absPath: "/repo/core-tools/memory/file with spaces.ts", relPath: "core-tools/memory/file with spaces.ts", status: "M", staged: false },
        { absPath: "/repo/core-tools/memory/file-with-dashes.ts", relPath: "core-tools/memory/file-with-dashes.ts", status: "M", staged: false },
        { absPath: "/repo/core-tools/memory/file_with_underscores.ts", relPath: "core-tools/memory/file_with_underscores.ts", status: "M", staged: false },
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1);
      assert.equal(groups[0].label, "core-tools/memory");
      assert.equal(groups[0].files.length, 3);
    });

    it("handles deeply nested directories without crashing", () => {
      const files: DirtyFile[] = [
        { absPath: "/repo/a/b/c/d/e/f/g/h/deeply/nested/file.ts", relPath: "a/b/c/d/e/f/g/h/deeply/nested/file.ts", status: "M", staged: false },
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1);
      assert.equal(groups[0].label, "a/b", "should use first two segments");
    });

    it("handles paths with dots in directory names", () => {
      const files: DirtyFile[] = [
        { absPath: "/repo/v1.0.0/src/index.ts", relPath: "v1.0.0/src/index.ts", status: "M", staged: false },
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1, "should group v1.0.0/src as one group");
      assert.equal(groups[0].label, "v1.0.0/src", "label should be v1.0.0/src");
    });
  });

  describe("prompt generation safety", () => {
    it("handles very long file paths without truncation", () => {
      const group: CommitGroup = {
        label: "core-tools/memory",
        scope: "memory",
        files: [{ absPath: "/repo/deep/nested/path/file.ts", relPath: "deep/nested/path/file.ts", status: "M", staged: false }],
      };

      const prompt = buildCommitPrompt(group, "stat", "diff", []);
      assert.ok(prompt.includes("deep/nested/path"));
    });

    it("handles very large diffs without crashing", () => {
      const largeDiff = "line\n".repeat(10000);

      const group: CommitGroup = {
        label: "core-tools/memory",
        scope: "memory",
        files: [{ absPath: "/repo/file.ts", relPath: "file.ts", status: "M", staged: false }],
      };

      const prompt = buildCommitPrompt(group, "stat", largeDiff, []);
      assert.ok(prompt);
      assert.ok(prompt.length > 0);
    });

    it("handles empty quality results gracefully", () => {
      const group: CommitGroup = {
        label: "core-tools/memory",
        scope: "memory",
        files: [{ absPath: "/repo/file.ts", relPath: "file.ts", status: "M", staged: false }],
      };

      const prompt = buildCommitPrompt(group, "stat", "diff", []);
      assert.ok(prompt);
      assert.ok(!prompt.includes("undefined"));
      assert.ok(!prompt.includes("null"));
    });

    it("handles special characters in diff output", () => {
      const specialDiff = "Line with 🚀 emoji\nLine with special chars: @#$%^&*()\nLine with quotes: \"double\" 'single'";

      const group: CommitGroup = {
        label: "core-tools/memory",
        scope: "memory",
        files: [{ absPath: "/repo/file.ts", relPath: "file.ts", status: "M", staged: false }],
      };

      const prompt = buildCommitPrompt(group, "stat", specialDiff, []);
      assert.ok(prompt.includes("🚀"));
      assert.ok(prompt.includes("@#$%"));
      assert.ok(prompt.includes("double"));
    });
  });

  describe("boundary conditions", () => {
    it("handles empty file list", () => {
      const groups = groupDirtyFiles([]);
      assert.deepEqual(groups, [], "empty input should give empty groups");
    });

    it("handles single file", () => {
      const files: DirtyFile[] = [
        { absPath: "/repo/file.ts", relPath: "file.ts", status: "M", staged: false },
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1, "should create one group");
      assert.equal(groups[0].label, "root", "root-level file should be in 'root' group");
    });

    it("handles very large number of files in single group", () => {
      const files: DirtyFile[] = Array.from({ length: 1000 }, (_, i) => ({
        absPath: `/repo/core-tools/memory/file${i}.ts`,
        relPath: `core-tools/memory/file${i}.ts`,
        status: "M" as const,
        staged: false,
      }));

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1, "should put all in one group");
      assert.equal(groups[0].files.length, 1000, "should include all 1000 files");
    });

    it("handles very large number of groups", () => {
      const files: DirtyFile[] = Array.from({ length: 100 }, (_, i) => ({
        absPath: `/repo/group${i}/sub/file.ts`,
        relPath: `group${i}/sub/file.ts`,
        status: "M" as const,
        staged: false,
      }));

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 100);
    });
  });
});
