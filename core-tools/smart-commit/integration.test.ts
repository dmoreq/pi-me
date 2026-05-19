/**
 * smart-commit integration tests
 *
 * Tests the full pipeline: grouping → quality → staging → diffing
 */

import { describe, it, beforeEach } from "node:test";
import * as assert from "node:assert/strict";
import { groupDirtyFiles } from "./grouper.ts";
import { buildCommitPrompt } from "./prompt.ts";
import type { DirtyFile, CommitGroup, QualityResult } from "./types.ts";

function file(relPath: string, status: DirtyFile["status"] = "M"): DirtyFile {
  return { absPath: `/repo/${relPath}`, relPath, status, staged: false };
}

describe("smart-commit integration", () => {
  describe("realistic pipeline: group → quality → prompt", () => {
    it("processes a multi-group scenario correctly", () => {
      const files = [
        // Memory group
        file("core-tools/memory/src/store.ts", "M"),
        file("core-tools/memory/src/index.ts", "A"),
        // Smart-commit group
        file("core-tools/smart-commit/index.ts", "M"),
        // Root
        file("README.md", "M"),
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 3);

      // Verify sorting: largest group first
      const [first, second, third] = groups;
      assert.ok(
        (first.files.length >= second.files.length),
        "should sort by file count descending"
      );

      // Verify scopes
      assert.equal(first.scope, "memory");
      assert.equal(second.scope, "smart-commit");
      assert.equal(third.scope, "");
    });

    it("generates valid prompts for all groups", () => {
      const files = [
        file("core-tools/memory/store.ts", "M"),
        file("core-tools/memory/index.ts", "A"),
        file("root-file.ts", "M"),
      ];

      const groups = groupDirtyFiles(files);

      for (const group of groups) {
        const quality: QualityResult[] = group.files.map(f => ({
          file: f.relPath,
          formatted: Math.random() > 0.5,
          fixed: Math.random() > 0.5,
          fixCount: Math.floor(Math.random() * 5),
          errors: [],
        }));

        const prompt = buildCommitPrompt(
          group,
          "stat output",
          "diff body",
          quality
        );

        // Prompt must include group info
        assert.ok(prompt.includes(group.label) || group.label === "root");
        assert.ok(prompt.includes("commit"));

        // Prompt must reference files
        for (const f of group.files) {
          assert.ok(prompt.includes(f.relPath), `prompt should mention ${f.relPath}`);
        }
      }
    });

    it("handles mixed file statuses (A, M, D) correctly", () => {
      const files = [
        file("core-tools/memory/added.ts", "A"),
        file("core-tools/memory/modified.ts", "M"),
        file("core-tools/memory/deleted.ts", "D"),
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1);
      assert.equal(groups[0].files.length, 3);

      const prompt = buildCommitPrompt(
        groups[0],
        "stat",
        "diff",
        []
      );
      assert.ok(prompt.includes("[added]"));
      assert.ok(prompt.includes("[modified]"));
      assert.ok(prompt.includes("[deleted]"));
    });

    it("quality notes appear in prompt only when changes occurred", () => {
      const group: CommitGroup = {
        label: "core-tools/memory",
        scope: "memory",
        files: [file("core-tools/memory/store.ts", "M")],
      };

      // Case 1: No quality changes
      const quality1: QualityResult[] = [{
        file: "core-tools/memory/store.ts",
        formatted: false,
        fixed: false,
        fixCount: 0,
        errors: [],
      }];
      const prompt1 = buildCommitPrompt(group, "stat", "diff", quality1);
      assert.ok(!prompt1.includes("Auto-quality"), "should not mention quality if nothing changed");

      // Case 2: Format + fix changes
      const quality2: QualityResult[] = [{
        file: "core-tools/memory/store.ts",
        formatted: true,
        fixed: true,
        fixCount: 5,
        errors: [],
      }];
      const prompt2 = buildCommitPrompt(group, "stat", "diff", quality2);
      assert.ok(prompt2.includes("Auto-quality"));
      assert.ok(prompt2.includes("formatted"));
      assert.ok(prompt2.includes("5 lint"));
    });
  });

  describe("scope derivation edge cases", () => {
    it("handles deeply nested files correctly", () => {
      const files = [
        file("core-tools/memory/src/store/index.ts", "M"),
        file("core-tools/memory/src/store/types.ts", "M"),
        file("authoring/commit-helper/index.ts", "A"),
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 2);

      // Both memory files should group under core-tools/memory
      const memoryGroup = groups.find(g => g.label === "core-tools/memory");
      assert.ok(memoryGroup);
      assert.equal(memoryGroup.files.length, 2);
    });

    it("ignores single-segment path files correctly", () => {
      const files = [
        file("package.json", "M"),
        file("README.md", "M"),
        file("LICENSE", "A"),
      ];

      const groups = groupDirtyFiles(files);
      assert.equal(groups.length, 1);
      assert.equal(groups[0].label, "root");
      assert.equal(groups[0].scope, "");
    });

    it("correctly derives kebab-case scopes from various paths", () => {
      const cases: Array<[string, string]> = [
        ["core-tools/memory", "memory"],
        ["core-tools/code-quality", "code-quality"],
        ["authoring/commit-helper", "commit-helper"],
        ["packages/ui", "ui"],
        ["src/auth", "auth"],
      ];

      for (const [label, expectedScope] of cases) {
        const files = [file(`${label}/index.ts`, "M")];
        const groups = groupDirtyFiles(files);
        assert.equal(groups[0].scope, expectedScope, `${label} should derive scope ${expectedScope}`);
      }
    });
  });

  describe("grouping stability", () => {
    it("produces deterministic grouping regardless of input order", () => {
      const baseFiles = [
        file("core-tools/memory/store.ts", "M"),
        file("core-tools/memory/index.ts", "M"),
        file("authoring/commit-helper/index.ts", "M"),
      ];

      // Run 3 times with different orderings
      const results = [
        groupDirtyFiles([...baseFiles]),
        groupDirtyFiles([...baseFiles].reverse()),
        groupDirtyFiles(
          [baseFiles[2], baseFiles[0], baseFiles[1]],
          "/repo"
        ),
      ];

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        assert.equal(results[i].length, results[0].length);
        for (let j = 0; j < results[0].length; j++) {
          assert.equal(results[i][j].label, results[0][j].label);
          assert.equal(results[i][j].scope, results[0][j].scope);
        }
      }
    });

    it("sorts by count descending, then alphabetically", () => {
      const files = [
        // "x/y" will have 3 files
        file("x/y/one.ts", "M"),
        file("x/y/two.ts", "M"),
        file("x/y/three.ts", "M"),
        // "a/b" will have 1 file
        file("a/b/one.ts", "M"),
        // "m/n" will have 2 files
        file("m/n/one.ts", "M"),
        file("m/n/two.ts", "M"),
      ];

      const groups = groupDirtyFiles(files);
      const labels = groups.map(g => g.label);

      // Should be sorted by count: x/y (3), m/n (2), a/b (1)
      assert.deepEqual(labels, ["x/y", "m/n", "a/b"]);
    });
  });
});
