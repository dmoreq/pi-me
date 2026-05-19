import { describe, it } from "bun:test";
import * as assert from "node:assert/strict";
import { groupDirtyFiles } from "./grouper.ts";
import type { DirtyFile } from "./types.ts";

function file(relPath: string, status: DirtyFile["status"] = "M"): DirtyFile {
  return { absPath: `/repo/${relPath}`, relPath, status, staged: false };
}

const ROOT = "/repo";

describe("groupDirtyFiles", () => {
  it("groups files by first two path segments", () => {
    const files = [
      file("core-tools/memory/src/store.ts"),
      file("core-tools/memory/src/index.ts"),
      file("core-tools/smart-commit/index.ts"),
    ];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups.length, 2);
    const labels = groups.map(g => g.label).sort();
    assert.deepEqual(labels, ["core-tools/memory", "core-tools/smart-commit"]);
  });

  it("puts root-level files in 'root' group", () => {
    const files = [file("README.md"), file("package.json")];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].label, "root");
    assert.equal(groups[0].scope, "");
  });

  it("derives scope from last path segment", () => {
    const files = [file("core-tools/memory/src/store.ts")];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups[0].scope, "memory");
  });

  it("scope is empty string for root group", () => {
    const files = [file("README.md")];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups[0].scope, "");
  });

  it("sorts groups by file count descending", () => {
    const files = [
      file("a/b/one.ts"),
      file("x/y/one.ts"),
      file("x/y/two.ts"),
      file("x/y/three.ts"),
    ];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups[0].label, "x/y");   // 3 files
    assert.equal(groups[1].label, "a/b");   // 1 file
  });

  it("handles single-segment paths as root", () => {
    const files = [file("CHANGELOG.md")];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups[0].label, "root");
  });

  it("handles mix of root and nested files", () => {
    const files = [
      file("README.md"),
      file("core-tools/memory/store.ts"),
    ];
    const groups = groupDirtyFiles(files, ROOT);
    assert.equal(groups.length, 2);
    assert.ok(groups.some(g => g.label === "root"));
    assert.ok(groups.some(g => g.label === "core-tools/memory"));
  });

  it("returns empty array for no files", () => {
    assert.deepEqual(groupDirtyFiles([], ROOT), []);
  });
});
