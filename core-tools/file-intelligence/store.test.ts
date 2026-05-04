/**
 * FileStore — unit tests
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FileStore } from "./store.ts";
import type { FileIndex } from "./types.ts";

function makeIndex(filePath: string): FileIndex {
  return {
    path: filePath,
    language: filePath.endsWith(".ts") ? "typescript" : "javascript",
    lines: 100,
    imports: [],
    exports: [],
    classes: [],
    functions: [],
    types: [],
    lastIndexedAt: new Date().toISOString(),
  };
}

describe("FileStore", () => {
  let tempDir: string;
  let store: FileStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-store-"));
    store = new FileStore(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe("save and get", () => {
    it("should save and retrieve an index", async () => {
      const index = makeIndex("src/app.ts");
      await store.save(index);

      const retrieved = await store.get("src/app.ts");
      assert.ok(retrieved !== null);
      assert.strictEqual(retrieved?.path, "src/app.ts");
    });

    it("should persist to disk", async () => {
      const index = makeIndex("src/app.ts");
      await store.save(index);

      // Verify file exists
      const files = fs.readdirSync(tempDir);
      assert.ok(files.length > 0);
    });

    it("should return null for missing index", async () => {
      const result = await store.get("nonexistent.ts");
      assert.strictEqual(result, null);
    });
  });

  describe("getAll", () => {
    it("should return all saved indexes", async () => {
      await store.save(makeIndex("file1.ts"));
      await store.save(makeIndex("file2.ts"));

      const all = await store.getAll();
      assert.strictEqual(all.length, 2);
    });

    it("should return empty array when no indexes", async () => {
      const all = await store.getAll();
      assert.strictEqual(all.length, 0);
    });
  });

  describe("delete", () => {
    it("should delete an index", async () => {
      const index = makeIndex("src/app.ts");
      await store.save(index);
      assert.ok(await store.get("src/app.ts") !== null);

      await store.delete("src/app.ts");
      assert.strictEqual(await store.get("src/app.ts"), null);
    });

    it("should handle deleting non-existent index", async () => {
      await assert.doesNotReject(async () => store.delete("nonexistent.ts"));
    });
  });

  describe("clear", () => {
    it("should clear all indexes", async () => {
      await store.save(makeIndex("file1.ts"));
      await store.save(makeIndex("file2.ts"));

      await store.clear();
      const all = await store.getAll();
      assert.strictEqual(all.length, 0);
    });
  });

  describe("count", () => {
    it("should count indexed files", async () => {
      await store.save(makeIndex("file1.ts"));
      await store.save(makeIndex("file2.ts"));

      const count = await store.count();
      assert.strictEqual(count, 2);
    });
  });

  describe("search", () => {
    it("should find files by pattern", async () => {
      await store.save(makeIndex("src/app.ts"));
      await store.save(makeIndex("src/utils.ts"));
      await store.save(makeIndex("test/app.test.ts"));

      const results = await store.search(/^src\//);
      assert.strictEqual(results.length, 2);
    });

    it("should return empty for no matches", async () => {
      await store.save(makeIndex("src/app.ts"));

      const results = await store.search(/^test\//);
      assert.strictEqual(results.length, 0);
    });
  });

  describe("getByLanguage", () => {
    it("should filter by language", async () => {
      await store.save(makeIndex("src/app.ts"));
      await store.save(makeIndex("src/utils.ts"));
      await store.save(makeIndex("src/app.js"));

      const ts = await store.getByLanguage("typescript");
      assert.strictEqual(ts.length, 2);
    });
  });
});
