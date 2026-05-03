/**
 * Structural similarity checks for write/edit events.
 *
 * Two checks run in sequence when content is written or edited:
 *  1. Export redefinition — blocks if a named export already exists in another file
 *  2. Structural similarity — warns if a new function is structurally similar to one elsewhere
 *
 * Designed to be called from the read-guard's tool_call handler.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

// ── Export-redefinition check ────────────────────────────────────────────

const EXPORT_RE =
	/export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+(\w+)/g;
const SOURCE_EXTS = new Set([
	".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
]);

/**
 * Build a map of export name → file path by scanning source files.
 * Cached per session — call once at startup.
 */
export function buildExportIndex(rootDir: string): Map<string, string> {
	const index = new Map<string, string>();
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
					for (const match of content.matchAll(EXPORT_RE)) {
						const name = match[1];
						if (!index.has(name)) {
							index.set(name, fullPath);
						}
					}
				} catch {
					// Skip unreadable files
				}
			}
		}
	}

	scan(rootDir);
	return index;
}

/**
 * Check if new content redefines an export that already exists elsewhere.
 * Returns a block message if a conflict is found, or null if clean.
 */
export function checkExportRedefinition(
	newContent: string,
	filePath: string,
	exportIndex: Map<string, string>,
	projectRoot: string,
): string | null {
	const warnings: string[] = [];
	for (const match of newContent.matchAll(EXPORT_RE)) {
		const name = match[1];
		const existingFile = exportIndex.get(name);
		if (existingFile && resolve(existingFile) !== resolve(filePath)) {
			const rel = relative(projectRoot, existingFile);
			warnings.push(`\`${name}\` already exists in \`${rel}\``);
		}
	}
	if (warnings.length === 0) return null;
	return (
		"🔴 STOP — Redefining existing export(s). Import instead:\n" +
		warnings.map((w) => `  • ${w}`).join("\n")
	);
}

// ── Structural similarity check (advisory) ───────────────────────────────

/**
 * Simple Jaccard similarity between two strings based on token overlap.
 * Tokens are alphanumeric words extracted from the text.
 */
export function jaccardSimilarity(a: string, b: string): number {
	const tokensA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
	const tokensB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));

	let intersection = 0;
	for (const token of tokensA) {
		if (tokensB.has(token)) intersection++;
	}

	const union = tokensA.size + tokensB.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * Advisory check: warn if the new function body resembles a known function.
 * Returns a warning string or null.
 */
export function checkStructuralSimilarity(
	newContent: string,
	filePath: string,
	projectRoot: string,
): string | null {
	// Extract function bodies from new content
	const funcRe =
		/(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{([^}]*(?:{[^}]*}[^}]*)*)}/g;
	const newFuncs: Array<{ name: string; body: string }> = [];
	for (const match of newContent.matchAll(funcRe)) {
		const nameMatch = match[0].match(
			/(?:async\s+)?function\s+(\w+)/,
		);
		if (nameMatch) {
			newFuncs.push({ name: nameMatch[1], body: match[1] });
		}
	}

	if (newFuncs.length === 0) return null;

	// Scan existing files for similar functions
	const warnings: string[] = [];
	const SIMILARITY_THRESHOLD = 0.85;

	function scanDir(dir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (warnings.length >= 3) return;
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name.startsWith(".") ||
					entry.name === "node_modules" ||
					entry.name === "dist"
				) {
					continue;
				}
				scanDir(fullPath);
			} else if (SOURCE_EXTS.has(extname(entry.name))) {
				if (resolve(fullPath) === resolve(filePath)) continue;
				try {
					const existingContent = readFileSync(fullPath, "utf-8");
					for (const match of existingContent.matchAll(funcRe)) {
						const nameMatch = match[0].match(
							/(?:async\s+)?function\s+(\w+)/,
						);
						if (!nameMatch) continue;
						const existingName = nameMatch[1];
						for (const nf of newFuncs) {
							const sim = jaccardSimilarity(nf.body, match[1]);
							if (sim >= SIMILARITY_THRESHOLD) {
								const rel = relative(projectRoot, fullPath);
								const pct = Math.round(sim * 100);
								warnings.push(
									`\`${nf.name}\` is ${pct}% similar to \`${existingName}\` in \`${rel}\``,
								);
							}
						}
					}
				} catch {
					// Skip unreadable
				}
			}
		}
	}

	scanDir(projectRoot);

	if (warnings.length === 0) return null;
	return (
		"⚠️  Potential structural similarity (advisory):\n" +
		warnings.map((w) => `  • ${w}`).join("\n") +
		"\nVerify behavior before refactoring."
	);
}
