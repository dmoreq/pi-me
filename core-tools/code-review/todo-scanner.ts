/**
 * TODO/FIXME/HACK inventory scanner.
 *
 * Scans source files for comment markers and classifies them by severity.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────

export interface TodoItem {
	file: string;
	line: number;
	type: "TODO" | "FIXME" | "HACK" | "XXX" | "NOTE";
	text: string;
}

export interface TodoSummary {
	total: number;
	byType: Record<string, number>;
	byFile: Record<string, number>;
	items: TodoItem[];
}

// ── Pattern ──────────────────────────────────────────────────────────────

const TODO_RE =
	/\/\/\s*(TODO|FIXME|HACK|XXX|NOTE)\b[:\s]*(.*)$|\/\*\s*(TODO|FIXME|HACK|XXX|NOTE)\b[:\s]*([\s\S]*?)\*\//im;

const SOURCE_EXTS = new Set([
	".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".rb",
	".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
]);

// ── Scanner ──────────────────────────────────────────────────────────────

export function scanTodos(rootDir: string): TodoSummary {
	const items: TodoItem[] = [];
	const scanned = new Set<string>();

	function scan(dir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name.startsWith(".") ||
					entry.name === "node_modules" ||
					entry.name === "dist"
				) {
					continue;
				}
				scan(fullPath);
			} else if (SOURCE_EXTS.has(extname(entry.name))) {
				if (scanned.has(fullPath)) continue;
				scanned.add(fullPath);
				try {
					const content = readFileSync(fullPath, "utf-8");
					const lines = content.split("\n");
					for (let i = 0; i < lines.length; i++) {
						const match = lines[i].match(TODO_RE);
						if (match) {
							const type = (match[1] ?? match[3]) as TodoItem["type"];
							const text = (match[2] ?? match[4] ?? "").trim();
							items.push({
								file: fullPath,
								line: i + 1,
								type,
								text: text || "(no details)",
							});
						}
					}
				} catch {
					// Skip unreadable files
				}
			}
		}
	}

	scan(rootDir);

	const byType: Record<string, number> = {};
	const byFile: Record<string, number> = {};
	for (const item of items) {
		byType[item.type] = (byType[item.type] ?? 0) + 1;
		byFile[item.file] = (byFile[item.file] ?? 0) + 1;
	}

	return { total: items.length, byType, byFile, items };
}
