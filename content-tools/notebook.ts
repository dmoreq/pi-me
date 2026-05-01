/**
 * pi-me: notebook — Jupyter notebook (.ipynb) cell editor.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import * as fs from "node:fs/promises";

interface NotebookCell { cell_type: "code" | "markdown" | "raw"; source: string[]; metadata: Record<string, unknown>; execution_count?: number | null; outputs?: unknown[]; }
interface Notebook { cells: NotebookCell[]; metadata: Record<string, unknown>; nbformat: number; nbformat_minor: number; }

function splitIntoLines(content: string): string[] {
	return content.split("\n").map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line));
}

async function readNotebook(path: string): Promise<Notebook> {
	const text = await fs.readFile(path, "utf-8");
	const nb = JSON.parse(text);
	if (!nb.cells || !Array.isArray(nb.cells)) throw new Error("Invalid notebook: missing cells array");
	return nb as Notebook;
}

async function writeNotebook(path: string, nb: Notebook): Promise<void> {
	await fs.writeFile(path, JSON.stringify(nb, null, 1) + "\n", "utf-8");
}

function cellPreview(cell: NotebookCell, index: number): string {
	const source = cell.source.join("");
	const preview = source.length > 100 ? source.slice(0, 100) + "..." : source;
	return `[${index}] ${cell.cell_type}: ${preview}`;
}

const NotebookParams = Type.Object({
	action: StringEnum(["read", "edit", "insert", "delete"] as const),
	notebook_path: Type.String({ description: "Path to .ipynb file" }),
	cell_index: Type.Optional(Type.Number({ description: "0-based cell index" })),
	cell_type: Type.Optional(StringEnum(["code", "markdown"] as const, { description: "Cell type for insert" })),
	content: Type.Optional(Type.String({ description: "New cell content" })),
});

export function registerNotebook(pi: ExtensionAPI) {
	pi.registerTool({
		name: "notebook", label: "Notebook",
		description: "Edit Jupyter notebook (.ipynb) cells. Actions: read, edit, insert, delete.",
		parameters: NotebookParams,
		concurrency: "exclusive",
		async execute(_toolCallId, params) {
			try {
				const nb = await readNotebook(params.notebook_path);
				switch (params.action) {
					case "read": {
						if (nb.cells.length === 0) return ok("Notebook is empty (0 cells).");
						const list = nb.cells.map((c, i) => `  ${cellPreview(c, i)}`).join("\n");
						return ok(`${nb.cells.length} cells:\n${list}`, { action: "read", totalCells: nb.cells.length, cellTypes: nb.cells.map(c => c.cell_type) });
					}
					case "edit": {
						if (params.cell_index === undefined || !params.content) return err("cell_index and content required for edit");
						if (params.cell_index < 0 || params.cell_index >= nb.cells.length) return err(`Cell index ${params.cell_index} out of range (0-${nb.cells.length - 1})`);
						const oldSource = nb.cells[params.cell_index].source.join("");
						nb.cells[params.cell_index].source = splitIntoLines(params.content);
						await writeNotebook(params.notebook_path, nb);
						return ok(`Edited cell ${params.cell_index}`, { action: "edit", cellIndex: params.cell_index, totalCells: nb.cells.length, oldSource, newSource: params.content });
					}
					case "insert": {
						const idx = params.cell_index ?? nb.cells.length;
						if (idx < 0 || idx > nb.cells.length) return err(`Cell index ${idx} out of range (0-${nb.cells.length})`);
						const cellType = params.cell_type ?? "code";
						const source = params.content ? splitIntoLines(params.content) : [""];
						nb.cells.splice(idx, 0, { cell_type: cellType, source, metadata: {}, execution_count: null, outputs: [] });
						await writeNotebook(params.notebook_path, nb);
						return ok(`Inserted ${cellType} cell at index ${idx}`, { action: "insert", cellIndex: idx, cellType, totalCells: nb.cells.length });
					}
					case "delete": {
						if (params.cell_index === undefined) return err("cell_index required for delete");
						if (params.cell_index < 0 || params.cell_index >= nb.cells.length) return err(`Cell index ${params.cell_index} out of range (0-${nb.cells.length - 1})`);
						const removed = nb.cells.splice(params.cell_index, 1)[0];
						await writeNotebook(params.notebook_path, nb);
						return ok(`Deleted cell ${params.cell_index}`, { action: "delete", cellIndex: params.cell_index, totalCells: nb.cells.length, removedSource: removed.source.join("") });
					}
					default: return err(`Unknown action: ${(params as any).action}`);
				}
			} catch (err: unknown) { return err(`Notebook error: ${err instanceof Error ? err.message : String(err)}`); }
		},
	});
}

function ok(text: string, details?: Record<string, unknown>) { return { content: [{ type: "text" as const, text }], details }; }
function err(text: string) { return { content: [{ type: "text" as const, text: `Error: ${text}` }] }; }

export default registerNotebook;
