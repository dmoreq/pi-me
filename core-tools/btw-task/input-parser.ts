/**
 * btw-task — Input parser.
 *
 * Detects "btw" (by the way) patterns in user input and extracts tasks.
 *
 * Supported patterns:
 *   /btw fix login, refactor db, update docs
 *   btw also fix the auth module and write tests
 *   Also, btw: deploy to staging, notify team
 */

// ─── Constants ──────────────────────────────────────────────────────────

/** Prefix for the dedicated /btw command. */
const BTW_COMMAND_PREFIX = "/btw ";

/** Words/phrases that signal "by the way" task injection. */
const BTW_TRIGGERS = /\bbtw\b/i;

/** Delimiters that separate individual tasks. */
const TASK_DELIMITERS = /[,;，；、]|\band\b|\balso\b|\bthen\b|\bafter that\b/gi;

/** Cleanup: strip trigger words and leading noise from each task. */
const LEADING_NOISE = /^(btw\s*[:：]?\s*|also\s*|and\s*|,\s*|;\s*|\s+)/i;

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Parse user input for btw task patterns.
 *
 * @param text  Raw user input
 * @returns     Array of task strings, or null if no btw pattern detected
 */
export function parseBtwInput(text: string): string[] | null {
	if (!text || text.length < 5) return null;

	const trimmed = text.trim();

	// ── /btw command ─────────────────────────────────────────
	if (trimmed.startsWith("/btw ")) {
		const raw = trimmed.slice("/btw ".length).trim();
		if (!raw) return null;
		return parseTaskList(raw);
	}

	// ── Natural language "btw" ────────────────────────────────
	// Only match "btw" as a standalone word, not inside other words
	if (!BTW_TRIGGERS.test(trimmed)) return null;

	// Find the "btw" position
	const match = trimmed.match(BTW_TRIGGERS);
	if (!match || match.index === undefined) return null;

	// Everything after "btw" is the task list
	const afterBtw = trimmed.slice(match.index + match[0].length).trim();
	if (!afterBtw) return null;

	return parseTaskList(afterBtw);
}

// ─── Internal ───────────────────────────────────────────────────────────

/**
 * Parse a raw task list string into individual task descriptions.
 *
 * "/btw fix login, refactor db, update docs"
 *   → ["fix login", "refactor db", "update docs"]
 *
 * "also fix the auth module and write tests"
 *   → ["fix the auth module", "write tests"]
 */
function parseTaskList(raw: string): string[] {
	// Split on delimiters
	const parts = raw.split(TASK_DELIMITERS);

	const tasks: string[] = [];
	for (let part of parts) {
		part = part.trim()
			.replace(LEADING_NOISE, "")
			.replace(/\s+/g, " ")
			.trim();

		if (!part) continue;
		if (part.length < 2) continue; // skip single chars
		tasks.push(part);
	}

	return tasks.length > 0 ? tasks : null!; // null-check handled by caller
}
