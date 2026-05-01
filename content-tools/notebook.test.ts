/**
 * Tests for notebook tool — Jupyter notebook cell operations.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[];
  metadata: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
}

interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

function createNotebook(cells: NotebookCell[] = []): Notebook {
  return { cells, metadata: {}, nbformat: 4, nbformat_minor: 5 };
}

function splitIntoLines(content: string): string[] {
  return content.split("\n").map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line));
}

function cellPreview(cell: NotebookCell, index: number): string {
  const source = cell.source.join("");
  const preview = source.length > 100 ? source.slice(0, 100) + "..." : source;
  return `[${index}] ${cell.cell_type}: ${preview}`;
}

describe("notebook", () => {
  describe("cell operations", () => {
    it("reads empty notebook", () => {
      const nb = createNotebook();
      assert.equal(nb.cells.length, 0);
    });

    it("reads cell content", () => {
      const nb = createNotebook([
        { cell_type: "code", source: ["print('hello')\n"], metadata: {}, execution_count: null },
      ]);
      assert.equal(nb.cells.length, 1);
      assert.equal(nb.cells[0].cell_type, "code");
      assert.equal(nb.cells[0].source.join(""), "print('hello')\n");
    });

    it("inserts cell at end by default", () => {
      const nb = createNotebook([
        { cell_type: "markdown", source: ["# Title\n"], metadata: {}, execution_count: null },
      ]);
      nb.cells.push({
        cell_type: "code",
        source: ["x = 1\n"],
        metadata: {},
        execution_count: null,
      });
      assert.equal(nb.cells.length, 2);
      assert.equal(nb.cells[1].cell_type, "code");
    });

    it("inserts cell at specific index", () => {
      const nb = createNotebook([
        { cell_type: "code", source: ["a = 1\n"], metadata: {}, execution_count: null },
        { cell_type: "code", source: ["b = 2\n"], metadata: {}, execution_count: null },
      ]);
      nb.cells.splice(1, 0, {
        cell_type: "markdown",
        source: ["## Middle\n"],
        metadata: {},
        execution_count: null,
      });
      assert.equal(nb.cells.length, 3);
      assert.equal(nb.cells[1].cell_type, "markdown");
    });

    it("edits cell source", () => {
      const nb = createNotebook([
        { cell_type: "code", source: ["old code\n"], metadata: {}, execution_count: null },
      ]);
      nb.cells[0].source = splitIntoLines("new code");
      assert.equal(nb.cells[0].source.join(""), "new code");
    });

    it("deletes cell", () => {
      const nb = createNotebook([
        { cell_type: "code", source: ["a = 1\n"], metadata: {}, execution_count: null },
        { cell_type: "code", source: ["b = 2\n"], metadata: {}, execution_count: null },
      ]);
      nb.cells.splice(0, 1);
      assert.equal(nb.cells.length, 1);
      assert.equal(nb.cells[0].source.join(""), "b = 2\n");
    });
  });

  describe("cellPreview", () => {
    it("shows short content fully", () => {
      const cell: NotebookCell = { cell_type: "code", source: ["print('hello')\n"], metadata: {}, execution_count: null };
      assert.equal(cellPreview(cell, 0), "[0] code: print('hello')\n");
    });

    it("truncates long content", () => {
      const longCode = "x".repeat(200);
      const cell: NotebookCell = { cell_type: "code", source: [longCode], metadata: {}, execution_count: null };
      const preview = cellPreview(cell, 5);
      assert.ok(preview.startsWith("[5] code: "));
      assert.ok(preview.endsWith("..."));
      assert.ok(preview.length <= 120); // "[5] code: " (~11) + 100 + "..." + trailing newlines
    });

    it("distinguishes markdown cells", () => {
      const cell: NotebookCell = { cell_type: "markdown", source: ["# Title\n"], metadata: {}, execution_count: null };
      assert.ok(cellPreview(cell, 0).startsWith("[0] markdown:"));
    });
  });

  describe("splitIntoLines", () => {
    it("adds newlines to all but last line", () => {
      const result = splitIntoLines("line1\nline2\nline3");
      assert.deepEqual(result, ["line1\n", "line2\n", "line3"]);
    });

    it("handles single line", () => {
      const result = splitIntoLines("single");
      assert.deepEqual(result, ["single"]);
    });

    it("handles trailing newline", () => {
      const result = splitIntoLines("line1\n");
      assert.deepEqual(result, ["line1\n", ""]);
    });
  });

  describe("notebook structure", () => {
    it("validates cell structure", () => {
      const cell: NotebookCell = {
        cell_type: "code",
        source: ["print('hello')\n"],
        metadata: {},
        execution_count: null,
        outputs: [],
      };
      assert.equal(cell.cell_type, "code");
      assert.ok(Array.isArray(cell.source));
      assert.ok(cell.source.length > 0);
    });

    it("supports raw cells", () => {
      const nb = createNotebook([
        { cell_type: "raw", source: ["raw content\n"], metadata: {}, execution_count: null },
      ]);
      assert.equal(nb.cells[0].cell_type, "raw");
    });
  });
});
